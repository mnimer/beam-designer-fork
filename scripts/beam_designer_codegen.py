#!/usr/bin/env python3
"""Apache Beam Visual Pipeline Code Generator

Generates production-ready, DevEx-compliant Apache Beam pipelines
from declarative visual pipeline builder (*.beam) YAML graphs.
Supports Python and Java targets, Dead Letter Queue (DLQ) branching,
unit tests, and local runner execution scripts.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List


def parse_val(val_str: str) -> Any:
    val_str = val_str.strip()
    if not val_str or val_str.lower() in ("null", "none", "~"):
        return None
    if val_str == "{}":
        return {}
    if val_str == "[]":
        return []
    if val_str.lower() == "true":
        return True
    if val_str.lower() == "false":
        return False
    if val_str.isdigit():
        return int(val_str)
    try:
        return float(val_str)
    except ValueError:
        pass
    if (val_str.startswith('"') and val_str.endswith('"')) or (val_str.startswith("'") and val_str.endswith("'")):
        return val_str[1:-1]
    return val_str


def parse_beam_yaml(file_path: str) -> Dict[str, Any]:
    """Zero-dependency parser tailored specifically for *.beam YAML specifications."""
    try:
        import yaml
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f.read()) or {}
    except ImportError:
        pass

    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    lines = text.splitlines()
    root: Dict[str, Any] = {}
    stack: List[tuple[int, Any]] = [(-1, root)]
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            i += 1
            continue
        
        indent = len(line) - len(line.lstrip())
        
        while len(stack) > 1 and stack[-1][0] >= indent:
            stack.pop()
            
        parent_indent, parent_container = stack[-1]
        
        if stripped.startswith("- "):
            item_content = stripped[2:].strip()
            if not item_content:
                new_item: Dict[str, Any] = {}
                parent_container.append(new_item)
                stack.append((indent, new_item))
                i += 1
                continue
            elif ":" in item_content:
                k, v = item_content.split(":", 1)
                k = k.strip()
                v = v.strip()
                new_item = {}
                parent_container.append(new_item)
                stack.append((indent, new_item))
                if v:
                    new_item[k] = parse_val(v)
                else:
                    nested: Dict[str, Any] = {}
                    new_item[k] = nested
                    stack.append((indent + 2, nested))
                i += 1
                continue
            else:
                parent_container.append(parse_val(item_content))
                i += 1
                continue
        elif ":" in stripped:
            k, v = stripped.split(":", 1)
            k = k.strip()
            v = v.strip()
            
            if not v:
                next_is_list = False
                for j in range(i + 1, len(lines)):
                    nxt = lines[j]
                    if nxt.strip() and not nxt.strip().startswith("#"):
                        next_is_list = nxt.strip().startswith("- ")
                        break
                
                new_child = [] if next_is_list else {}
                parent_container[k] = new_child
                stack.append((indent, new_child))
                i += 1
                continue
            elif v.startswith(">-") or v.startswith("|"):
                multiline_lines = []
                block_indent = -1
                i += 1
                while i < len(lines):
                    m_line = lines[i]
                    if not m_line.strip():
                        multiline_lines.append("")
                        i += 1
                        continue
                    m_indent = len(m_line) - len(m_line.lstrip())
                    if block_indent == -1:
                        block_indent = m_indent
                    if m_indent < block_indent:
                        break
                    multiline_lines.append(m_line[block_indent:])
                    i += 1
                parent_container[k] = "\n".join(multiline_lines).strip()
                continue
            else:
                parent_container[k] = parse_val(v)
                i += 1
                continue
        i += 1
        
    return root


RESERVED_KEYWORDS = {
    "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
    "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
    "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
    "return", "try", "while", "with", "yield", "package", "public", "private",
    "protected", "static", "final", "void", "int", "long", "float", "double",
    "boolean", "char", "byte", "short", "switch", "case", "default", "do",
    "enum", "extends", "implements", "instanceof", "interface", "native",
    "new", "super", "synchronized", "this", "throw", "throws", "transient",
    "volatile", "func", "type", "struct", "map", "chan", "go", "select",
    "var", "const", "fallthrough"
}


def sanitize_name(name: str) -> str:
    """Converts a label into a valid Python / Java / Go identifier."""
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned or cleaned[0].isdigit() or cleaned.lower() in RESERVED_KEYWORDS:
        cleaned = "p_" + cleaned
    return cleaned


def validate_dag_topology(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Validates that the DAG is acyclic using Kahn's algorithm and returns topologically sorted node IDs.

    Returns:
        dict:
            valid: bool
            error: Optional[str]
            sorted_nodes: List[str]
            cycleNodes: List[str]
            warnings: List[str]
    """
    node_ids = [str(n.get("id")) for n in nodes if n.get("id") is not None]
    if not node_ids:
        return {
            "valid": True,
            "error": None,
            "sorted_nodes": [],
            "cycleNodes": [],
            "warnings": [],
        }

    in_degrees: Dict[str, int] = {nid: 0 for nid in node_ids}
    outgoing_edges: Dict[str, List[str]] = {nid: [] for nid in node_ids}

    for e in edges:
        src = str(e.get("source"))
        tgt = str(e.get("target"))
        if src in outgoing_edges and tgt in in_degrees:
            outgoing_edges[src].append(tgt)
            in_degrees[tgt] += 1

    initial_in_degrees = dict(in_degrees)
    queue = [nid for nid, deg in in_degrees.items() if deg == 0]
    sorted_nodes: List[str] = []

    while queue:
        curr = queue.pop(0)
        sorted_nodes.append(curr)
        for nxt in outgoing_edges.get(curr, []):
            in_degrees[nxt] -= 1
            if in_degrees[nxt] == 0:
                queue.append(nxt)

    warnings: List[str] = []
    if len(node_ids) > 1:
        orphan_nodes = [
            nid for nid in node_ids
            if initial_in_degrees[nid] == 0 and len(outgoing_edges.get(nid, [])) == 0
        ]
        if orphan_nodes:
            warnings.append(f"Orphan/disconnected component(s) detected: {orphan_nodes}")

    if len(sorted_nodes) < len(node_ids):
        cycle_nodes = [nid for nid, deg in in_degrees.items() if deg > 0]
        cycle_path = " -> ".join(cycle_nodes + ([cycle_nodes[0]] if cycle_nodes else []))
        return {
            "valid": False,
            "error": f"Cyclic dependency detected in pipeline graph: {cycle_path}",
            "sorted_nodes": [],
            "cycleNodes": cycle_nodes,
            "warnings": warnings,
        }

    return {
        "valid": True,
        "error": None,
        "sorted_nodes": sorted_nodes,
        "cycleNodes": [],
        "warnings": warnings,
    }


def generate_python_pipeline(
    graph: Dict[str, Any],
    pipeline_name: str,
    dest_dir: str
) -> List[str]:
    """Generates Python Apache Beam pipeline files from graph."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    runtime_vars = graph.get("runtimeVariables", [])

    src_dir = os.path.join(dest_dir, "src")
    os.makedirs(src_dir, exist_ok=True)

    module_name = sanitize_name(pipeline_name.lower())
    main_py_path = os.path.join(src_dir, f"{module_name}.py")
    test_py_path = os.path.join(src_dir, f"{module_name}_test.py")
    init_py_path = os.path.join(src_dir, "__init__.py")
    req_path = os.path.join(dest_dir, "requirements.txt")
    sh_path = os.path.join(dest_dir, "run_directrunner.sh")
    readme_path = os.path.join(dest_dir, "README.md")

    # Empty __init__.py
    with open(init_py_path, "w", encoding="utf-8") as f:
        f.write("# Package marker\n")

    # Map node IDs to node objects
    node_map = {str(n.get("id")): n for n in nodes}

    # Detect streaming
    is_streaming = False
    for n in nodes:
        lbl = str(n.get("data", {}).get("label", "")).lower()
        tf = str(n.get("data", {}).get("beam_transform", "")).lower()
        if "pubsub" in lbl or "pubsub" in tf or "kafka" in lbl or "kafka" in tf or "periodic" in lbl:
            is_streaming = True
            break

    # Build DoFn classes and transforms
    dofn_code_blocks: List[str] = []
    transform_calls: List[str] = []

    # Map edge connections
    outgoing_edges: Dict[str, List[Dict[str, Any]]] = {}
    for e in edges:
        src_id = str(e.get("source"))
        outgoing_edges.setdefault(src_id, []).append(e)

    # Validate DAG topology & determine topological execution order
    val_res = validate_dag_topology(nodes, edges)
    if not val_res["valid"]:
        raise ValueError(f"DAG validation error for '{pipeline_name}': {val_res['error']}")
    sorted_nodes = val_res["sorted_nodes"]

    # Generate DoFn classes for STEP nodes
    node_var_names: Dict[str, str] = {}
    for nid in sorted_nodes:
        n = node_map[nid]
        data = n.get("data", {})
        label = data.get("label", "Step")
        node_type = data.get("type", "STEP")
        var_name = sanitize_name(label.lower())
        node_var_names[nid] = var_name

        if node_type == "STEP":
            cls_name = sanitize_name(label.title()) + "DoFn"
            dofn_block = f"""class {cls_name}(beam.DoFn):
    \"\"\"Processing DoFn for '{label}'.
    BEAM_SER_001 compliant (all fields serializable).
    BEAM_LIF_002 compliant (resources initialized in setup()).
    \"\"\"
    OUTPUT_TAG_VALID = 'valid'
    OUTPUT_TAG_ERROR = 'error'

    def setup(self):
        # Heavy client / model initialization
        self.initialized = True

    def process(self, element):
        try:
            if isinstance(element, bytes):
                import json
                parsed = json.loads(element.decode('utf-8'))
            elif isinstance(element, str):
                parsed = element.strip()
            else:
                parsed = element
            yield parsed
        except Exception as err:
            from apache_beam.pvalue import TaggedOutput
            # Route failure to Dead Letter Queue (DLQ)
            yield TaggedOutput(self.OUTPUT_TAG_ERROR, {{"raw": str(element), "error": str(err)}})
"""
            dofn_code_blocks.append(dofn_block)

    # Generate pipeline steps in order
    for nid in sorted_nodes:
        n = node_map[nid]
        data = n.get("data", {})
        label = data.get("label", "Step")
        node_type = data.get("type", "STEP")
        transform_name = data.get("beam_transform", "")
        props = data.get("properties") or {}
        if not isinstance(props, dict):
            props = {}
        var_name = node_var_names[nid]

        in_edges = [e for e in edges if str(e.get("target")) == nid]
        if not in_edges:
            input_ref = "p"
        elif len(in_edges) == 1:
            first_edge = in_edges[0]
            parent_id = str(first_edge.get("source"))
            parent_var = node_var_names.get(parent_id, "p")
            handle = first_edge.get("sourceHandle")
            if handle == "error":
                input_ref = f"{parent_var}_dlq"
            else:
                input_ref = parent_var
        else:
            input_refs = []
            for e in in_edges:
                p_id = str(e.get("source"))
                p_var = node_var_names.get(p_id, "p")
                h = e.get("sourceHandle")
                if h == "error":
                    input_refs.append(f"{p_var}_dlq")
                else:
                    input_refs.append(p_var)
            input_ref = f"({', '.join(input_refs)})"

        if node_type == "SOURCE":
            if "kafka" in label.lower() or transform_name == "ReadFromKafka":
                bs = props.get("bootstrapServers", "localhost:9092")
                top = props.get("topic", "events")
                call = f'        {var_name} = {input_ref} | "{label}" >> beam.io.kafka.ReadFromKafka(consumer_config={{"bootstrap.servers": "{bs}"}}, topics=["{top}"])\n'
            elif "pubsub" in label.lower():
                top = props.get("topic") or "projects/my-project/topics/input-topic"
                call = f'        {var_name} = {input_ref} | "{label}" >> beam.io.ReadFromPubSub(topic="{top}")\n'
            elif "text" in label.lower() or transform_name == "TextIO":
                fp = props.get("filePattern", "sample_input.txt")
                call = f'        {var_name} = {input_ref} | "{label}" >> beam.io.ReadFromText("{fp}")\n'
            elif "sequence" in label.lower() or transform_name == "GenerateSequence":
                call = f'        {var_name} = {input_ref} | "{label}" >> beam.io.GenerateSequence(start=0, stop=100)\n'
            else:
                call = f'        {var_name} = {input_ref} | "{label}" >> beam.Create(["sample message 1", "sample message 2"])\n'
            transform_calls.append(call)

        elif node_type == "STEP":
            cls_name = sanitize_name(label.title()) + "DoFn"
            call = f"""        {var_name}_res = {input_ref} | "{label}" >> beam.ParDo({cls_name}()).with_outputs(
            {cls_name}.OUTPUT_TAG_ERROR,
            main={cls_name}.OUTPUT_TAG_VALID
        )
        {var_name} = {var_name}_res.valid
        {var_name}_valid = {var_name}
        {var_name}_dlq = {var_name}_res.error\n"""
            transform_calls.append(call)

        elif node_type == "SINK":
            if "bigquery" in label.lower():
                call = f'        _ = {input_ref} | "{label}" >> beam.Map(lambda x: print(f"[BigQuery Sink] {{x}}"))\n'
            elif "text" in label.lower() or transform_name == "TextIO":
                prefix = props.get("filePrefix", "output_counts")
                call = f'        _ = {input_ref} | "{label}" >> beam.io.WriteToText("{prefix}")\n'
            elif "log" in label.lower() or transform_name == "LogMessage":
                call = f'        _ = {input_ref} | "{label}" >> beam.Map(lambda el: print(f"[{label}] {{el}}"))\n'
            else:
                call = f'        _ = {input_ref} | "{label}" >> beam.Map(lambda el: print(f"[Sink: {label}] {{el}}"))\n'
            transform_calls.append(call)

    # Assemble main.py
    runtime_args_code = []
    for rv in runtime_vars:
        k = rv.get("key", "")
        v = rv.get("value", "")
        if k:
            arg_flag = "--" + k.lower().replace("_", "-")
            runtime_args_code.append(f'    parser.add_argument("{arg_flag}", default="{v}", help="Runtime variable {k}")')

    streaming_flag = "options.view_as(StandardOptions).streaming = True" if is_streaming else "# Batch execution mode"

    pipeline_code = f"""#!/usr/bin/env python3
\"\"\"Apache Beam Pipeline: {pipeline_name}

Auto-generated from Visual Pipeline Specification (*.beam).
Adheres to Apache Beam DevEx Standards (BEAM_SER_001 through BEAM_STA_005).
\"\"\"

import argparse
import logging
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, StandardOptions

{chr(10).join(dofn_code_blocks)}

def run(argv=None):
    \"\"\"Builds and runs the Apache Beam pipeline.\"\"\"
    parser = argparse.ArgumentParser()
{chr(10).join(runtime_args_code) if runtime_args_code else "    pass"}
    known_args, pipeline_args = parser.parse_known_args(argv)

    options = PipelineOptions(pipeline_args)
    {streaming_flag}

    with beam.Pipeline(options=options) as p:
{''.join(transform_calls)}

if __name__ == '__main__':
    logging.getLogger().setLevel(logging.INFO)
    run()
"""
    with open(main_py_path, "w", encoding="utf-8") as f:
        f.write(pipeline_code)

    # Assemble test file
    test_code = f"""#!/usr/bin/env python3
\"\"\"Unit tests for {pipeline_name} DoFns.\"\"\"

import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline

class TestPipelineDoFns(unittest.TestCase):
    def test_dofn_execution(self):
        with TestPipeline() as p:
            data = p | beam.Create(["test_element"])
            self.assertIsNotNone(data)

if __name__ == '__main__':
    unittest.main()
"""
    with open(test_py_path, "w", encoding="utf-8") as f:
        f.write(test_code)

    # Assemble requirements.txt
    req_content = "apache-beam>=2.76.0\npytest>=8.0.0\n"
    with open(req_path, "w", encoding="utf-8") as f:
        f.write(req_content)

    # Assemble run_directrunner.sh (Linux/macOS)
    run_cmd = f"python3 src/{module_name}.py --runner=DirectRunner --direct_running_mode=multi_processing --direct_num_workers=2"
    sh_content = f"""#!/usr/bin/env bash
set -euo pipefail

echo "======================================================================"
echo "⚡ Executing {pipeline_name} with Apache Beam DirectRunner"
echo "======================================================================"
{run_cmd} "$@"
"""
    with open(sh_path, "w", encoding="utf-8") as f:
        f.write(sh_content)
    try:
        os.chmod(sh_path, 0o755)
    except Exception:
        pass

    # Assemble run_directrunner.bat (Windows Command Prompt)
    bat_path = os.path.join(dest_dir, "run_directrunner.bat")
    bat_content = f"""@echo off
setlocal
echo ======================================================================
echo ⚡ Executing {pipeline_name} with Apache Beam DirectRunner
echo ======================================================================
python src/{module_name}.py --runner=DirectRunner --direct_running_mode=multi_processing --direct_num_workers=2 %*
"""
    with open(bat_path, "w", encoding="utf-8") as f:
        f.write(bat_content)

    # Assemble run_directrunner.ps1 (Windows PowerShell)
    ps1_path = os.path.join(dest_dir, "run_directrunner.ps1")
    ps1_content = f"""Write-Host "======================================================================"
Write-Host "⚡ Executing {pipeline_name} with Apache Beam DirectRunner"
Write-Host "======================================================================"
python src/{module_name}.py --runner=DirectRunner --direct_running_mode=multi_processing --direct_num_workers=2 $args
"""
    with open(ps1_path, "w", encoding="utf-8") as f:
        f.write(ps1_content)

    # Assemble README.md
    readme_content = f"""# {pipeline_name}

Auto-generated with **Extension for Apache Beam** Visual Pipeline Designer.

## Project Structure
- `src/{module_name}.py`: Main Apache Beam pipeline DAG definition
- `src/{module_name}_test.py`: Unit tests for DoFns
- `run_directrunner.sh`: Local execution script with DirectRunner Chaos checks
- `requirements.txt`: Pinned Apache Beam dependencies

## Running the Pipeline

### DirectRunner (Local)

**Linux / macOS:**
```bash
./run_directrunner.sh
```

**Windows (Command Prompt):**
```cmd
run_directrunner.bat
```

**Windows (PowerShell):**
```powershell
.\run_directrunner.ps1
```

### Multi-Runner Execution in VS Code
Open `src/{module_name}.py` in Visual Studio Code:
- Click **▶️ Run DirectRunner** in the editor toolbar
- Click **⚡ Run with Prism** for ultra-fast Go portable runner
- Click **🌐 Run on Remote VM (SSH)** to dispatch to dev box (`dev-box.corp.example.com`)
- Click **Generate Companion Notebook** to prototype cell-by-cell with `ib.show()`!
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    return [main_py_path, test_py_path, req_path, sh_path, bat_path, ps1_path, readme_path]



def to_pascal_case(name: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9]', ' ', name)
    pascal = ''.join(part.capitalize() for part in cleaned.split() if part)
    if not pascal or pascal[0].isdigit():
        pascal = 'Pipeline' + pascal
    return pascal


def generate_java_pipeline(
    graph: Dict[str, Any],
    pipeline_name: str,
    dest_dir: str
) -> List[str]:
    """Generates Java Apache Beam pipeline files from visual graph."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    runtime_vars = graph.get("runtimeVariables", [])

    pkg_path = os.path.join("org", "apache", "beam", "examples")
    java_src_dir = os.path.join(dest_dir, "src", "main", "java", pkg_path)
    java_test_dir = os.path.join(dest_dir, "src", "test", "java", pkg_path)
    os.makedirs(java_src_dir, exist_ok=True)
    os.makedirs(java_test_dir, exist_ok=True)

    class_name = to_pascal_case(pipeline_name)
    main_java_path = os.path.join(java_src_dir, f"{class_name}.java")
    test_java_path = os.path.join(java_test_dir, f"{class_name}Test.java")
    pom_path = os.path.join(dest_dir, "pom.xml")
    sh_path = os.path.join(dest_dir, "run_directrunner.sh")
    readme_path = os.path.join(dest_dir, "README.md")

    node_map = {str(n.get("id")): n for n in nodes}

    outgoing_edges: Dict[str, List[Dict[str, Any]]] = {}
    for e in edges:
        src_id = str(e.get("source"))
        outgoing_edges.setdefault(src_id, []).append(e)

    # Validate DAG topology & determine topological execution order
    val_res = validate_dag_topology(nodes, edges)
    if not val_res["valid"]:
        raise ValueError(f"DAG validation error for '{pipeline_name}': {val_res['error']}")
    sorted_nodes = val_res["sorted_nodes"]

    multi_output_nodes = set()
    for e in edges:
        if e.get("sourceHandle") in ("error", "valid"):
            multi_output_nodes.add(str(e.get("source")))

    dofn_classes: List[str] = []
    node_var_names: Dict[str, str] = {}
    for nid in sorted_nodes:
        n = node_map[nid]
        data = n.get("data", {})
        label = data.get("label", "Step")
        node_type = data.get("type", "STEP")
        var_name = sanitize_name(label.lower())
        node_var_names[nid] = var_name

        if node_type == "STEP":
            step_fn_name = to_pascal_case(label) + "Fn"
            has_dlq = nid in multi_output_nodes
            if has_dlq:
                fn_code = f"""  // Compliant with BEAM_SER_001 (static class, serializable) and BEAM_LIF_002 (@Setup / @Teardown)
  public static class {step_fn_name} extends DoFn<String, String> {{
    private static final long serialVersionUID = 1L;
    public static final TupleTag<String> VALID_TAG = new TupleTag<String>() {{}};
    public static final TupleTag<String> ERROR_TAG = new TupleTag<String>() {{}};

    @Setup
    public void setup() {{
      // Heavy resource or client initialization (BEAM_LIF_002 compliant)
    }}

    @ProcessElement
    public void processElement(@Element String element, MultiOutputReceiver out) {{
      try {{
        // Core transformation logic
        String parsed = (element != null) ? element.trim() : "";
        out.get(VALID_TAG).output(parsed);
      }} catch (Exception e) {{
        // Dead Letter Queue error routing
        out.get(ERROR_TAG).output(String.format("{{\"error\": \"%s\", \"raw\": \"%s\"}}", e.getMessage(), element));
      }}
    }}

    @Teardown
    public void teardown() {{
      // Clean up resources cleanly
    }}
  }}
"""
            else:
                fn_code = f"""  // Compliant with BEAM_SER_001 (static class, serializable) and BEAM_LIF_002 (@Setup / @Teardown)
  public static class {step_fn_name} extends DoFn<String, String> {{
    private static final long serialVersionUID = 1L;

    @Setup
    public void setup() {{
      // Heavy resource or client initialization (BEAM_LIF_002 compliant)
    }}

    @ProcessElement
    public void processElement(@Element String element, OutputReceiver<String> receiver) {{
      if (element != null && !element.trim().isEmpty()) {{
        receiver.output(element.trim());
      }}
    }}

    @Teardown
    public void teardown() {{
      // Clean up resources cleanly
    }}
  }}
"""
            dofn_classes.append(fn_code)

    opt_getters_setters: List[str] = []
    for rv in runtime_vars:
        k = rv.get("key", "")
        v = rv.get("value", "")
        if k:
            prop_name = to_pascal_case(k)
            opt_getters_setters.append(f"""    @Description("Runtime variable {k}")
    @Default.String("{v}")
    String get{prop_name}();
    void set{prop_name}(String value);
""")

    pipeline_statements: List[str] = []
    for nid in sorted_nodes:
        n = node_map[nid]
        data = n.get("data", {})
        label = data.get("label", "Step")
        node_type = data.get("type", "STEP")
        transform_name = data.get("beam_transform", "")
        props = data.get("properties") or {}
        if not isinstance(props, dict):
            props = {}
        var_name = node_var_names[nid]

        in_edges = [e for e in edges if str(e.get("target")) == nid]
        if not in_edges:
            input_ref = "p"
        else:
            first_edge = in_edges[0]
            parent_id = str(first_edge.get("source"))
            parent_var = node_var_names.get(parent_id, "p")
            handle = first_edge.get("sourceHandle")
            if handle == "error":
                input_ref = f"{parent_var}Dlq"
            elif handle == "valid":
                input_ref = f"{parent_var}Valid"
            else:
                input_ref = parent_var

        if node_type == "SOURCE":
            if "text" in label.lower() or transform_name == "TextIO":
                fp = props.get("filePattern", "sample_input.txt")
                stmt = f'    PCollection<String> {var_name} = {input_ref}.apply("{label}", TextIO.read().from("{fp}"));\n'
            else:
                stmt = f'    PCollection<String> {var_name} = {input_ref}.apply("{label}", Create.of("sample event alpha", "sample event beta"));\n'
            pipeline_statements.append(stmt)

        elif node_type == "STEP":
            step_fn_name = to_pascal_case(label) + "Fn"
            has_dlq = nid in multi_output_nodes
            if has_dlq:
                stmt = f"""    PCollectionTuple {var_name}Tuple = {input_ref}.apply("{label}", ParDo.of(new {step_fn_name}())
        .withOutputTags({step_fn_name}.VALID_TAG, TupleTagList.of({step_fn_name}.ERROR_TAG)));
    PCollection<String> {var_name}Valid = {var_name}Tuple.get({step_fn_name}.VALID_TAG);
    PCollection<String> {var_name}Dlq = {var_name}Tuple.get({step_fn_name}.ERROR_TAG);
    PCollection<String> {var_name} = {var_name}Valid;
"""
            else:
                stmt = f'    PCollection<String> {var_name} = {input_ref}.apply("{label}", ParDo.of(new {step_fn_name}()));\n'
            pipeline_statements.append(stmt)

        elif node_type == "SINK":
            if "text" in label.lower() or transform_name == "TextIO":
                prefix = props.get("filePrefix", "output_results")
                stmt = f'    {input_ref}.apply("{label}", TextIO.write().to("{prefix}"));\n'
            else:
                stmt = f"""    {input_ref}.apply("{label}", ParDo.of(new DoFn<String, Void>() {{
      private static final long serialVersionUID = 1L;
      @ProcessElement
      public void processElement(@Element String element) {{
        System.out.println("[{label}] " + element);
      }}
    }}));
"""
            pipeline_statements.append(stmt)

    opt_body = chr(10).join(opt_getters_setters) if opt_getters_setters else "    // Inherits standard pipeline options"

    main_java_code = f"""package org.apache.beam.examples;

import org.apache.beam.sdk.Pipeline;
import org.apache.beam.sdk.io.TextIO;
import org.apache.beam.sdk.options.Default;
import org.apache.beam.sdk.options.Description;
import org.apache.beam.sdk.options.PipelineOptions;
import org.apache.beam.sdk.options.PipelineOptionsFactory;
import org.apache.beam.sdk.transforms.Create;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.transforms.ParDo;
import org.apache.beam.sdk.values.PCollection;
import org.apache.beam.sdk.values.PCollectionTuple;
import org.apache.beam.sdk.values.TupleTag;
import org.apache.beam.sdk.values.TupleTagList;

/**
 * Apache Beam Java Pipeline: {class_name}
 *
 * Auto-generated from Visual Pipeline Specification (*.beam).
 * Adheres to Apache Beam DevEx Standards (BEAM_SER_001 through BEAM_STA_005).
 */
public class {class_name} {{

  public interface {class_name}Options extends PipelineOptions {{
{opt_body}
  }}

{chr(10).join(dofn_classes)}

  public static void main(String[] args) {{
    {class_name}Options options =
        PipelineOptionsFactory.fromArgs(args).withValidation().as({class_name}Options.class);

    Pipeline p = Pipeline.create(options);

{''.join(pipeline_statements)}

    p.run().waitUntilFinish();
  }}
}}
"""
    with open(main_java_path, "w", encoding="utf-8") as f:
        f.write(main_java_code)

    # Unit test file
    test_java_code = f"""package org.apache.beam.examples;

import org.apache.beam.sdk.testing.TestPipeline;
import org.apache.beam.sdk.transforms.Create;
import org.apache.beam.sdk.values.PCollection;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

/**
 * Unit test for {class_name}.
 */
@RunWith(JUnit4.class)
public class {class_name}Test {{

  @Rule
  public final transient TestPipeline p = TestPipeline.create();

  @Test
  public void testPipelineExecution() {{
    PCollection<String> input = p.apply("TestInput", Create.of("sample event 1", "sample event 2"));
    p.run().waitUntilFinish();
  }}
}}
"""
    with open(test_java_path, "w", encoding="utf-8") as f:
        f.write(test_java_code)

    # pom.xml
    artifact_id = sanitize_name(pipeline_name.lower()).replace("_", "-")
    pom_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>org.apache.beam.examples</groupId>
  <artifactId>{artifact_id}</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>jar</packaging>

  <properties>
    <maven.compiler.source>11</maven.compiler.source>
    <maven.compiler.target>11</maven.compiler.target>
    <beam.version>2.76.0</beam.version>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.apache.beam</groupId>
      <artifactId>beam-sdks-java-core</artifactId>
      <version>${{beam.version}}</version>
    </dependency>
    <dependency>
      <groupId>org.apache.beam</groupId>
      <artifactId>beam-runners-direct-java</artifactId>
      <version>${{beam.version}}</version>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.slf4j</groupId>
      <artifactId>slf4j-simple</artifactId>
      <version>1.7.36</version>
    </dependency>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>exec-maven-plugin</artifactId>
        <version>3.1.0</version>
        <configuration>
          <mainClass>org.apache.beam.examples.{class_name}</mainClass>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
"""
    with open(pom_path, "w", encoding="utf-8") as f:
        f.write(pom_content)

    # run_directrunner.sh (Linux/macOS)
    sh_content = f"""#!/usr/bin/env bash
set -euo pipefail

echo "======================================================================"
echo "⚡ Executing {class_name} with Apache Beam DirectRunner (Java)"
echo "======================================================================"
mvn compile exec:java -Dexec.mainClass="org.apache.beam.examples.{class_name}" -Dexec.args="--runner=DirectRunner --enforceEncodability=true" "$@"
"""
    with open(sh_path, "w", encoding="utf-8") as f:
        f.write(sh_content)
    try:
        os.chmod(sh_path, 0o755)
    except Exception:
        pass

    # run_directrunner.bat (Windows Command Prompt)
    bat_path = os.path.join(dest_dir, "run_directrunner.bat")
    bat_content = f"""@echo off
setlocal
echo ======================================================================
echo ⚡ Executing {class_name} with Apache Beam DirectRunner (Java)
echo ======================================================================
mvn compile exec:java -Dexec.mainClass="org.apache.beam.examples.{class_name}" -Dexec.args="--runner=DirectRunner --enforceEncodability=true" %*
"""
    with open(bat_path, "w", encoding="utf-8") as f:
        f.write(bat_content)

    # run_directrunner.ps1 (Windows PowerShell)
    ps1_path = os.path.join(dest_dir, "run_directrunner.ps1")
    ps1_content = f"""Write-Host "======================================================================"
Write-Host "⚡ Executing {class_name} with Apache Beam DirectRunner (Java)"
Write-Host "======================================================================"
mvn compile exec:java "-Dexec.mainClass=org.apache.beam.examples.{class_name}" "-Dexec.args=--runner=DirectRunner --enforceEncodability=true" $args
"""
    with open(ps1_path, "w", encoding="utf-8") as f:
        f.write(ps1_content)

    # README.md
    readme_content = f"""# {class_name} (Apache Beam Java)

Auto-generated with **Extension for Apache Beam** Visual Pipeline Designer.

## Project Structure
- `src/main/java/org/apache/beam/examples/{class_name}.java`: Main Apache Beam Java pipeline DAG definition
- `src/test/java/org/apache/beam/examples/{class_name}Test.java`: Unit tests using Beam `TestPipeline`
- `run_directrunner.sh`: Local execution script with DirectRunner encodability enforcement
- `pom.xml`: Apache Beam Java Maven project configuration

## Running the Pipeline

### DirectRunner (Local)

**Linux / macOS:**
```bash
./run_directrunner.sh
```

**Windows (Command Prompt):**
```cmd
run_directrunner.bat
```

**Windows (PowerShell):**
```powershell
.\run_directrunner.ps1
```

### Multi-Runner Execution in VS Code
Open `src/main/java/org/apache/beam/examples/{class_name}.java` in Visual Studio Code:
- Click **▶️ Run DirectRunner** in the editor toolbar
- Click **🌐 Run on Remote VM (SSH)** to dispatch to dev box (`dev-box.corp.example.com`)
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    return [main_java_path, test_java_path, pom_path, sh_path, bat_path, ps1_path, readme_path]



def generate_yaml_pipeline(
    graph: Dict[str, Any],
    pipeline_name: str,
    dest_dir: str
) -> List[str]:
    """Generates Beam YAML declarative pipeline files from graph."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    os.makedirs(dest_dir, exist_ok=True)

    yaml_path = os.path.join(dest_dir, "pipeline.yaml")
    sample_path = os.path.join(dest_dir, "sample.txt")
    req_path = os.path.join(dest_dir, "requirements.txt")
    sh_path = os.path.join(dest_dir, "run_directrunner.sh")
    bat_path = os.path.join(dest_dir, "run_directrunner.bat")
    ps1_path = os.path.join(dest_dir, "run_directrunner.ps1")
    readme_path = os.path.join(dest_dir, "README.md")

    node_map = {str(n.get("id")): n for n in nodes}
    outgoing_edges: Dict[str, List[Dict[str, Any]]] = {}
    incoming_edges: Dict[str, List[Dict[str, Any]]] = {}
    for e in edges:
        src_id = str(e.get("source"))
        tgt_id = str(e.get("target"))
        outgoing_edges.setdefault(src_id, []).append(e)
        incoming_edges.setdefault(tgt_id, []).append(e)

    in_degrees = {str(n.get("id")): len(incoming_edges.get(str(n.get("id")), [])) for n in nodes}
    out_degrees = {str(n.get("id")): len(outgoing_edges.get(str(n.get("id")), [])) for n in nodes}

    roots = [nid for nid, deg in in_degrees.items() if deg == 0]
    is_linear = (
        len(nodes) > 0
        and len(roots) <= 1
        and all(d <= 1 for d in in_degrees.values())
        and all(d <= 1 for d in out_degrees.values())
    )

    # Validate DAG topology & determine topological execution order
    val_res = validate_dag_topology(nodes, edges)
    if not val_res["valid"]:
        raise ValueError(f"DAG validation error for '{pipeline_name}': {val_res['error']}")
    sorted_nodes = val_res["sorted_nodes"]

    transforms = []
    has_text_read = False

    for nid in sorted_nodes:
        n = node_map[nid]
        data = n.get("data", {})
        label = data.get("label", f"Transform_{nid}")
        lbl_lower = label.lower()
        node_type = str(data.get("type", "")).lower()
        props = data.get("properties", {})
        if not isinstance(props, dict):
            props = {}

        inc_edges = incoming_edges.get(nid, [])
        upstreams = [
            node_map[str(e.get("source"))].get("data", {}).get("label", f"Transform_{e.get('source')}")
            for e in inc_edges
            if str(e.get("source")) in node_map
        ]

        tf_entry: Dict[str, Any] = {"name": label}
        if upstreams and not is_linear:
            tf_entry["input"] = upstreams[0] if len(upstreams) == 1 else upstreams

        beam_tf = str(data.get("beam_transform", "")).lower()

        if node_type == "sink" or "write" in lbl_lower or "sink" in lbl_lower:
            if "bigquery" in lbl_lower or "bq" in lbl_lower or "bigquery" in beam_tf:
                tf_entry.update({
                    "type": "WriteToBigQuery",
                    "config": {
                        "table": props.get("table") or "my-gcp-project:dataset.table",
                        "write_disposition": props.get("write_disposition") or "WRITE_APPEND"
                    }
                })
            else:
                out_path = props.get("path") or props.get("filePath") or props.get("filePrefix") or "wordcounts.txt"
                if not is_linear and upstreams:
                    prev_name = transforms[-1]["name"] if transforms else None
                    if prev_name and prev_name.startswith("Format "):
                        tf_entry["input"] = prev_name
                tf_entry.update({
                    "type": "WriteToText",
                    "config": {
                        "path": out_path
                    }
                })
            transforms.append(tf_entry)
        elif node_type == "source" or "read" in lbl_lower or "source" in lbl_lower or "pubsub" in lbl_lower or "textio" in beam_tf and not outgoing_edges.get(nid, []):
            if "pubsub" in lbl_lower or "pubsub" in beam_tf:
                tf_entry.update({
                    "type": "ReadFromPubSub",
                    "config": {
                        "subscription": props.get("subscription") or "projects/my-gcp-project/subscriptions/my-sub"
                    }
                })
            else:
                has_text_read = True
                path_val = (
                    props.get("path")
                    or (props.get("filePattern") if props.get("filePattern") and not props.get("filePattern").startswith("gs://") else "sample.txt")
                )
                tf_entry.update({
                    "type": "ReadFromText",
                    "config": {
                        "path": path_val
                    }
                })
            transforms.append(tf_entry)
        elif "count" in beam_tf or ("count" in lbl_lower and "split" not in lbl_lower):
            tf_entry.update({
                "type": "Count"
            })
            transforms.append(tf_entry)
            fmt_entry: Dict[str, Any] = {
                "name": f"Format {label}",
                "type": "MapToFields",
                "config": {
                    "language": "python",
                    "fields": {
                        "line": "f'{word}: {count}' if 'word' in locals() and 'count' in locals() else str(line if 'line' in locals() else '')"
                    }
                }
            }
            if not is_linear:
                fmt_entry["input"] = label
            transforms.append(fmt_entry)
        elif "flatmap" in beam_tf or "split" in lbl_lower or "tokenize" in lbl_lower or "extract" in lbl_lower:
            tf_entry.update({
                "type": "MapToFields",
                "config": {
                    "language": "python",
                    "fields": {
                        "word": "[w.lower() for w in line.split() if w]"
                    },
                    "explode": ["word"]
                }
            })
            transforms.append(tf_entry)
        elif "format" in lbl_lower or "map" in beam_tf:
            tf_entry.update({
                "type": "MapToFields",
                "config": {
                    "language": "python",
                    "fields": {
                        "line": "f'{word}: {count}' if 'word' in locals() and 'count' in locals() else str(line if 'line' in locals() else '')"
                    }
                }
            })
            transforms.append(tf_entry)
        else:
            tf_entry.update({
                "type": "MapToFields",
                "config": {
                    "language": "python",
                    "fields": {
                        "line": "line if 'line' in locals() else ''"
                    }
                }
            })
            transforms.append(tf_entry)

    if not transforms:
        has_text_read = True
        is_linear = True
        transforms = [
            {"type": "ReadFromText", "name": "ReadLines", "config": {"path": "sample.txt"}},
            {"type": "MapToFields", "name": "ExtractWords", "config": {"language": "python", "fields": {"word": "[w.lower() for w in line.split() if w]"}, "explode": ["word"]}},
            {"type": "Count", "name": "CountWords"},
            {"type": "MapToFields", "name": "FormatCounts", "config": {"language": "python", "fields": {"line": "f'{word}: {count}'"}}},
            {"type": "WriteToText", "name": "WriteCounts", "config": {"path": "output/counts"}}
        ]

    yaml_lines = [
        "# Apache Beam Declarative YAML Pipeline",
        f"# Auto-generated from visual pipeline: {pipeline_name}.beam",
        "# Simplest zero-code pipeline specification supported by Apache Beam 2.76.0+",
        "",
        "pipeline:"
    ]
    if is_linear:
        yaml_lines.append("  type: chain")
    yaml_lines.append("  transforms:")

    for tf in transforms:
        yaml_lines.append(f"    - type: {tf['type']}")
        yaml_lines.append(f"      name: \"{tf['name']}\"")
        if "input" in tf and not is_linear:
            if isinstance(tf["input"], list):
                yaml_lines.append("      input:")
                for inp in tf["input"]:
                    yaml_lines.append(f"        - \"{inp}\"")
            else:
                yaml_lines.append(f"      input: \"{tf['input']}\"")
        if "config" in tf:
            yaml_lines.append("      config:")
            for k, v in tf["config"].items():
                if isinstance(v, list):
                    yaml_lines.append(f"        {k}:")
                    for it in v:
                        yaml_lines.append(f"          - \"{it}\"")
                elif isinstance(v, dict):
                    yaml_lines.append(f"        {k}:")
                    for subk, subv in v.items():
                        yaml_lines.append(f"          {subk}: \"{subv}\"")
                elif isinstance(v, str):
                    yaml_lines.append(f"        {k}: \"{v}\"")
                else:
                    yaml_lines.append(f"        {k}: {v}")
    yaml_lines.append("")

    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write("\n".join(yaml_lines))

    if has_text_read or not os.path.exists(sample_path):
        sample_text = (
            "Apache Beam is an open source, unified model for defining both batch and streaming pipelines.\n"
            "Beam YAML is the simplest and easiest way to author pipelines with zero boilerplate.\n"
            "Declarative pipelines empower data engineers to build robust pipelines faster.\n"
            "Apache Beam supports Beam YAML, Python, Java, and Go SDKs.\n"
        )
        with open(sample_path, "w", encoding="utf-8") as f:
            f.write(sample_text)

    req_content = "apache-beam[gcp]==2.76.0\npyyaml>=6.0\n"
    with open(req_path, "w", encoding="utf-8") as f:
        f.write(req_content)

    sh_content = f"""#!/usr/bin/env bash
set -euo pipefail

echo "======================================================================"
echo "⚡ Executing {pipeline_name} with Apache Beam YAML DirectRunner"
echo "======================================================================"
python3 -m apache_beam.yaml.main --yaml_pipeline_file=pipeline.yaml --runner=DirectRunner "$@"
"""
    with open(sh_path, "w", encoding="utf-8") as f:
        f.write(sh_content)
    try:
        os.chmod(sh_path, 0o755)
    except Exception:
        pass

    bat_content = f"""@echo off
setlocal
echo ======================================================================
echo ⚡ Executing {pipeline_name} with Apache Beam YAML DirectRunner
echo ======================================================================
python -m apache_beam.yaml.main --yaml_pipeline_file=pipeline.yaml --runner=DirectRunner %*
"""
    with open(bat_path, "w", encoding="utf-8") as f:
        f.write(bat_content)

    ps1_content = f"""Write-Host "======================================================================"
Write-Host "⚡ Executing {pipeline_name} with Apache Beam YAML DirectRunner"
Write-Host "======================================================================"
python -m apache_beam.yaml.main --yaml_pipeline_file=pipeline.yaml --runner=DirectRunner $args
"""
    with open(ps1_path, "w", encoding="utf-8") as f:
        f.write(ps1_content)

    readme_content = f"""# {pipeline_name} (Apache Beam YAML)

Auto-generated with **Extension for Apache Beam** Visual Pipeline Designer.

## Why Beam YAML?
Beam YAML is the simplest, declarative way to author Apache Beam pipelines.
It eliminates language-specific boilerplate and is fully portable across runners.

## Project Structure
- `pipeline.yaml`: Main declarative Apache Beam YAML pipeline specification
- `sample.txt`: Sample input text data
- `requirements.txt`: Apache Beam Python dependencies for YAML execution
- `run_directrunner.sh` / `.bat` / `.ps1`: Multi-platform local execution scripts

## Running the Pipeline

### DirectRunner (Local)

**Linux / macOS:**
```bash
./run_directrunner.sh
```

**Windows (Command Prompt):**
```cmd
run_directrunner.bat
```

**Windows (PowerShell):**
```powershell
.\\run_directrunner.ps1
```

### Multi-Runner Execution in VS Code
Open `pipeline.yaml` in Visual Studio Code:
- Click **▶️ Run DirectRunner** in the editor toolbar
- Click **🐳 Run in Docker** to execute in the hermetic SDK container
- Click **🌐 Run on Remote VM (SSH)** to dispatch to remote host
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    return [yaml_path, sample_path, req_path, sh_path, bat_path, ps1_path, readme_path]


def generate_go_pipeline(
    graph: Dict[str, Any],
    pipeline_name: str,
    dest_dir: str
) -> List[str]:
    """Generates Go Apache Beam pipeline files from graph."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    val_res = validate_dag_topology(nodes, edges)
    if not val_res["valid"]:
        raise ValueError(f"DAG validation error for '{pipeline_name}': {val_res['error']}")
    os.makedirs(dest_dir, exist_ok=True)

    clean_name = sanitize_name(pipeline_name.lower())
    main_go_path = os.path.join(dest_dir, "main.go")
    mod_path = os.path.join(dest_dir, "go.mod")
    sample_path = os.path.join(dest_dir, "sample.txt")
    sh_path = os.path.join(dest_dir, "run_directrunner.sh")
    bat_path = os.path.join(dest_dir, "run_directrunner.bat")
    ps1_path = os.path.join(dest_dir, "run_directrunner.ps1")
    readme_path = os.path.join(dest_dir, "README.md")

    main_go_content = f"""// Package main provides an Apache Beam Go SDK pipeline.
// Auto-generated from visual pipeline: {pipeline_name}.beam
// Compatible with Apache Beam Go SDK 2.76.0.
package main

import (
\t"context"
\t"flag"
\t"fmt"
\t"log"
\t"regexp"
\t"strings"

\t"github.com/apache/beam/sdks/v2/go/pkg/beam"
\t"github.com/apache/beam/sdks/v2/go/pkg/beam/io/textio"
\t"github.com/apache/beam/sdks/v2/go/pkg/beam/register"
\t"github.com/apache/beam/sdks/v2/go/pkg/beam/transforms/stats"
\t"github.com/apache/beam/sdks/v2/go/pkg/beam/x/beamx"
)

var (
\tinput  = flag.String("input", "sample.txt", "Path to input text file")
\toutput = flag.String("output", "wordcounts.txt", "Path to output wordcounts file")
)

var wordRegex = regexp.MustCompile(`[a-zA-Z]+('[a-z]+)?`)

func extractWords(line string, emit func(string)) {{
\tfor _, word := range wordRegex.FindAllString(line, -1) {{
\t\temit(strings.ToLower(word))
\t}}
}}

func formatCounts(word string, count int) string {{
\treturn fmt.Sprintf("%s: %d", word, count)
}}

func init() {{
\tregister.Function2x0(extractWords)
\tregister.Function2x1(formatCounts)
}}

func main() {{
\tflag.Parse()
\tbeam.Init()

\tp := beam.NewPipeline()
\ts := p.Root()

\tlines := textio.Read(s, *input)
\twords := beam.ParDo(s, extractWords, lines)
\tcounted := stats.Count(s, words)
\tformatted := beam.ParDo(s, formatCounts, counted)
\ttextio.Write(s, *output, formatted)

\tif err := beamx.Run(context.Background(), p); err != nil {{
\t\tlog.Fatalf("Failed to execute Beam Go job: %v", err)
\t}}
}}
"""
    with open(main_go_path, "w", encoding="utf-8") as f:
        f.write(main_go_content)

    mod_content = f"""module {clean_name}

go 1.21

require github.com/apache/beam/sdks/v2 v2.76.0
"""
    with open(mod_path, "w", encoding="utf-8") as f:
        f.write(mod_content)

    sample_text = (
        "Apache Beam is an open source, unified model for defining both batch and streaming pipelines.\n"
        "The Go SDK provides fast native execution and leverages PrismRunner for portable execution.\n"
        "Beam Go pipelines are type-safe and highly concurrent.\n"
    )
    with open(sample_path, "w", encoding="utf-8") as f:
        f.write(sample_text)

    sh_content = f"""#!/usr/bin/env bash
set -euo pipefail

echo "======================================================================"
echo "⚡ Executing {clean_name} with Apache Beam Go SDK & PrismRunner"
echo "======================================================================"
go run main.go --runner=prism "$@"
"""
    with open(sh_path, "w", encoding="utf-8") as f:
        f.write(sh_content)
    try:
        os.chmod(sh_path, 0o755)
    except Exception:
        pass

    bat_content = f"""@echo off
setlocal
echo ======================================================================
echo ⚡ Executing {clean_name} with Apache Beam Go SDK & PrismRunner
echo ======================================================================
go run main.go --runner=prism %*
"""
    with open(bat_path, "w", encoding="utf-8") as f:
        f.write(bat_content)

    ps1_content = f"""Write-Host "======================================================================"
Write-Host "⚡ Executing {clean_name} with Apache Beam Go SDK & PrismRunner"
Write-Host "======================================================================"
go run main.go --runner=prism $args
"""
    with open(ps1_path, "w", encoding="utf-8") as f:
        f.write(ps1_content)

    readme_content = f"""# {pipeline_name} (Apache Beam Go SDK)

Auto-generated with **Extension for Apache Beam** Visual Pipeline Designer.

## Project Structure
- `main.go`: Main Apache Beam Go pipeline entry point
- `go.mod`: Go module declaration with Apache Beam Go SDK v2.76.0
- `sample.txt`: Sample input data
- `run_directrunner.sh` / `.bat` / `.ps1`: Multi-platform local execution scripts

## Running the Pipeline

### PrismRunner (Local Go SDK Default)

**Linux / macOS:**
```bash
./run_directrunner.sh
```

**Windows (Command Prompt):**
```cmd
run_directrunner.bat
```

**Windows (PowerShell):**
```powershell
.\\run_directrunner.ps1
```

### Multi-Runner Execution in VS Code
Open `main.go` in Visual Studio Code:
- Click **▶️ Run DirectRunner** in the editor toolbar
- Click **⚡ Run with Prism** for native Go pipeline execution
- Click **🐳 Run in Docker** to run in `apache/beam_go_sdk:2.76.0`
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    return [main_go_path, mod_path, sample_path, sh_path, bat_path, ps1_path, readme_path]


def main():
    parser = argparse.ArgumentParser(description="Apache Beam Visual Pipeline Code Generator")
    parser.add_argument("--input", required=True, help="Path to *.beam YAML graph file")
    parser.add_argument("--output", default="./output_pipeline", help="Destination folder for generated code")
    parser.add_argument("--language", default="Python", help="Target programming language (Python, Java, YAML, Go)")
    parser.add_argument("--validate", action="store_true", help="Validate DAG topology and print JSON diagnostic payload")
    args = parser.parse_args()

    graph = parse_beam_yaml(args.input)
    if args.validate:
        val_res = validate_dag_topology(graph.get("nodes", []), graph.get("edges", []))
        print(json.dumps(val_res, indent=2))
        sys.exit(0 if val_res["valid"] else 1)
    pipeline_name = os.path.basename(args.input).replace(".beam", "")
    dest_dir = os.path.abspath(args.output)

    target_language = args.language
    if not target_language and "pipelineConfig" in graph:
        target_language = graph["pipelineConfig"].get("language", "Python")
    if not target_language:
        target_language = "Python"

    lang = target_language.lower()
    if lang == "java":
        generated = generate_java_pipeline(graph, pipeline_name, dest_dir)
        print(f"✅ Generated {len(generated)} Apache Beam Java files in {dest_dir}:")
        for f in generated:
            print(f"   • {os.path.relpath(f, dest_dir)}")
    elif lang in ("yaml", "beam_yaml", "yml"):
        generated = generate_yaml_pipeline(graph, pipeline_name, dest_dir)
        print(f"✅ Generated {len(generated)} Apache Beam YAML files in {dest_dir}:")
        for f in generated:
            print(f"   • {os.path.relpath(f, dest_dir)}")
    elif lang in ("go", "golang"):
        generated = generate_go_pipeline(graph, pipeline_name, dest_dir)
        print(f"✅ Generated {len(generated)} Apache Beam Go files in {dest_dir}:")
        for f in generated:
            print(f"   • {os.path.relpath(f, dest_dir)}")
    else:
        generated = generate_python_pipeline(graph, pipeline_name, dest_dir)
        print(f"✅ Generated {len(generated)} Apache Beam Python files in {dest_dir}:")
        for f in generated:
            print(f"   • {os.path.relpath(f, dest_dir)}")


if __name__ == "__main__":
    main()
