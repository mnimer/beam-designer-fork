#!/usr/bin/env python3
"""Automated Test Suite for Apache Beam Designer Codegen & DAG Validation Engine.

Verifies:
1. Kahn's algorithm cycle detection and topological sorting.
2. Disconnected/orphan node diagnostic warnings.
3. Multi-SDK code generation (Python, Java, Go, Beam YAML) from .beam YAML DAGs.
4. Clean Python compilation (py_compile) across all bundled sample pipelines.
5. DLQ branching correctness (no double-unwrapping of PCollection attributes).
6. Reserved keyword sanitization and multi-input fan-in handling.
7. CLI interface for pipeline generation and --validate diagnostic checks.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from scripts.beam_designer_codegen import (
    generate_go_pipeline,
    generate_java_pipeline,
    generate_python_pipeline,
    generate_yaml_pipeline,
    main,
    parse_beam_yaml,
    sanitize_name,
    validate_dag_topology,
)


class TestCodegenEngine(unittest.TestCase):
    SAMPLES = [
        "batch-wordcount",
        "generate-mock-data",
        "kafka-to-iceberg",
        "pubsub-to-bigquery",
    ]

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="beam_codegen_test_")
        self.project_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..")
        )
        self.samples_dir = os.path.join(self.project_root, "resources", "samples")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_cycle_detection_kahn(self):
        """Verifies Kahn's algorithm detects cycles and returns structured error payloads."""
        cyclic_nodes = [
            {"id": "node_1", "type": "pipeline", "data": {"label": "Node 1", "type": "STEP"}},
            {"id": "node_2", "type": "pipeline", "data": {"label": "Node 2", "type": "STEP"}},
            {"id": "node_3", "type": "pipeline", "data": {"label": "Node 3", "type": "STEP"}},
        ]
        cyclic_edges = [
            {"source": "node_1", "target": "node_2"},
            {"source": "node_2", "target": "node_3"},
            {"source": "node_3", "target": "node_1"},
        ]

        val_res = validate_dag_topology(cyclic_nodes, cyclic_edges)
        self.assertFalse(val_res["valid"])
        self.assertIn("Cyclic dependency detected", val_res["error"])
        self.assertEqual(sorted(val_res["cycleNodes"]), ["node_1", "node_2", "node_3"])

        # Valid acyclic pipeline
        acyclic_edges = [
            {"source": "node_1", "target": "node_2"},
            {"source": "node_2", "target": "node_3"},
        ]
        val_acyclic = validate_dag_topology(cyclic_nodes, acyclic_edges)
        self.assertTrue(val_acyclic["valid"])
        self.assertEqual(val_acyclic["sorted_nodes"], ["node_1", "node_2", "node_3"])

    def test_orphan_disconnected_components(self):
        """Verifies that orphan nodes trigger non-fatal topology warnings."""
        nodes = [
            {"id": "n1", "type": "pipeline", "data": {"label": "Source", "type": "SOURCE"}},
            {"id": "n2", "type": "pipeline", "data": {"label": "Sink", "type": "SINK"}},
            {"id": "n_orphan", "type": "pipeline", "data": {"label": "Orphan Step", "type": "STEP"}},
        ]
        edges = [{"source": "n1", "target": "n2"}]
        res = validate_dag_topology(nodes, edges)
        self.assertTrue(res["valid"])
        self.assertEqual(len(res["warnings"]), 1)
        self.assertIn("n_orphan", res["warnings"][0])

    def test_dlq_no_double_unwrapping(self):
        """Asserts zero double-unwrapping attribute bugs across all sample pipelines."""
        for sample in self.SAMPLES:
            sample_path = os.path.join(self.samples_dir, f"{sample}.beam")
            self.assertTrue(os.path.exists(sample_path), f"Missing sample {sample_path}")
            out_dir = os.path.join(self.test_dir, sample, "python")
            graph = parse_beam_yaml(sample_path)
            generate_python_pipeline(graph, sample, out_dir)

            src_dir = os.path.join(out_dir, "src")
            for f in os.listdir(src_dir):
                if f.endswith(".py") and not f.endswith("_test.py") and f != "__init__.py":
                    with open(os.path.join(src_dir, f), "r", encoding="utf-8") as py_f:
                        code = py_f.read()

                    valid_lookups = [
                        x for x in re.findall(r"(\w+)\.valid", code)
                        if not x.endswith("_res")
                    ]
                    error_lookups = [
                        x for x in re.findall(r"(\w+)\.error", code)
                        if not x.endswith("_res")
                    ]

                    self.assertEqual(
                        valid_lookups,
                        [],
                        f"Found invalid .valid attribute access in {f}: {valid_lookups}",
                    )
                    self.assertEqual(
                        error_lookups,
                        [],
                        f"Found invalid .error attribute access in {f}: {error_lookups}",
                    )

    def test_python_py_compile(self):
        """Verifies that all generated Python pipelines pass python -m py_compile."""
        for sample in self.SAMPLES:
            sample_path = os.path.join(self.samples_dir, f"{sample}.beam")
            out_dir = os.path.join(self.test_dir, sample, "python")
            graph = parse_beam_yaml(sample_path)
            generate_python_pipeline(graph, sample, out_dir)

            src_dir = os.path.join(out_dir, "src")
            for f in os.listdir(src_dir):
                if f.endswith(".py"):
                    py_path = os.path.join(src_dir, f)
                    comp = subprocess.run(
                        [sys.executable, "-m", "py_compile", py_path],
                        capture_output=True,
                        text=True,
                    )
                    self.assertEqual(
                        comp.returncode,
                        0,
                        f"py_compile failed on {py_path}: {comp.stderr}",
                    )

    def test_multisdk_generation_smoke(self):
        """Verifies multi-SDK generation for Java, Go, and Beam YAML targets."""
        for sample in self.SAMPLES:
            sample_path = os.path.join(self.samples_dir, f"{sample}.beam")
            graph = parse_beam_yaml(sample_path)

            java_dir = os.path.join(self.test_dir, sample, "java")
            generate_java_pipeline(graph, sample, java_dir)
            self.assertTrue(os.path.exists(os.path.join(java_dir, "pom.xml")))

            go_dir = os.path.join(self.test_dir, sample, "go")
            generate_go_pipeline(graph, sample, go_dir)
            self.assertTrue(os.path.exists(os.path.join(go_dir, "main.go")))

            yaml_dir = os.path.join(self.test_dir, sample, "yaml")
            generate_yaml_pipeline(graph, sample, yaml_dir)
            self.assertTrue(os.path.exists(os.path.join(yaml_dir, "pipeline.yaml")))

    def test_reserved_keyword_sanitization(self):
        """Asserts Python/Java reserved keywords are safely sanitized to valid identifiers."""
        self.assertEqual(sanitize_name("import"), "p_import")
        self.assertEqual(sanitize_name("class"), "p_class")
        self.assertEqual(sanitize_name("def"), "p_def")
        self.assertEqual(sanitize_name("123bad"), "p_123bad")
        self.assertEqual(sanitize_name("ValidName"), "ValidName")

    def test_fan_in_multiple_inputs(self):
        """Asserts multi-input fan-in branches produce valid tuple syntax in Python."""
        graph = {
            "nodes": [
                {"id": "src_1", "type": "pipeline", "data": {"label": "Source 1", "type": "SOURCE"}},
                {"id": "src_2", "type": "pipeline", "data": {"label": "Source 2", "type": "SOURCE"}},
                {"id": "merge_step", "type": "pipeline", "data": {"label": "Merge", "type": "STEP", "beam_transform": "Flatten"}},
            ],
            "edges": [
                {"source": "src_1", "target": "merge_step"},
                {"source": "src_2", "target": "merge_step"},
            ],
        }
        out_dir = os.path.join(self.test_dir, "fan_in_test")
        generate_python_pipeline(graph, "fan_in_test", out_dir)

        pipe_file = os.path.join(out_dir, "src", "fan_in_test.py")
        with open(pipe_file, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn('(source_1, source_2) | "Merge"', code)

    def test_cli_main_all_targets_and_validate(self):
        """Tests CLI entrypoint for all target languages and --validate diagnostic flag."""
        sample_path = os.path.join(self.samples_dir, "batch-wordcount.beam")

        for lang in ["python", "java", "yaml", "go"]:
            out_dir = os.path.join(self.test_dir, f"cli_{lang}")
            test_args = [
                "beam_designer_codegen.py",
                "--input", sample_path,
                "--output", out_dir,
                "--language", lang,
            ]
            with patch.object(sys, "argv", test_args):
                exit_code = main()
                self.assertIn(exit_code, (0, None), f"CLI main failed for target {lang}")

        validate_args = [
            "beam_designer_codegen.py",
            "--input", sample_path,
            "--validate",
        ]
        with patch.object(sys, "argv", validate_args):
            with self.assertRaises(SystemExit) as cm:
                main()
            self.assertEqual(cm.exception.code, 0)
if __name__ == "__main__":
    unittest.main()
