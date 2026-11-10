# TextIO WordCount Batch Pipeline

## Overview
The classic Apache Beam **WordCount** batch pipeline demonstrating sequential text ingestion, regex tokenization, distributed per-element aggregation, string formatting, and sharded file output using `TextIO`.

This sample can be generated and executed in either **Python** or **Java** using the **Generate Code** panel.

## Pipeline Architecture & Data Flow
`Read Lines` ➔ `Extract Words` ➔ `Count Words` ➔ `Format As Text` ➔ `Write Counts`

1. **Read Lines (`TextIO` Source)**: Reads lines of text from an input file pattern (defaults to Shakespeare's *King Lear* at `gs://apache-beam-samples/shakespeare/kinglear.txt`).
2. **Extract Words (`FlatMap`)**: Splits each line into individual word tokens using the Unicode letter boundary regular expression `[^\p{L}]+` and filters out empty tokens.
3. **Count Words (`Count`)**: Aggregates word occurrences globally using `Count.perElement()` (Java) or `beam.combiners.Count.PerElement()` (Python) to produce `(word, count)` key-value pairs.
4. **Format As Text (`Map`)**: Formats each `(word, count)` pair into a human-readable `"word: count"` line.
5. **Write Counts (`TextIO` Sink)**: Writes the formatted word count lines to output text files (`wordcounts.txt`).

## Runtime Parameters
| Parameter | Default Value | Description |
|---|---|---|
| `JOB_ID` | `wordcount` | Unique batch pipeline job identifier |
| `inputFile` | `gs://apache-beam-samples/shakespeare/kinglear.txt` | Input file path or GCS glob pattern to read |
| `output` | `wordcounts` | Output file prefix for word count results |

## Code Generation & Execution
1. Click **New File** to save a copy of `textio-wordcount.beam` in your workspace.
2. Open the **Generate Code** tab, choose **Python** or **Java**, and click **Generate Code**.
3. Run locally with DirectRunner or deploy to Google Cloud Dataflow:
```bash
# Run locally with Apache Beam DirectRunner
./run_directrunner.sh

# Or deploy to Google Cloud Dataflow
export REGION="us-central1"
export GCS_STAGING_PATH="gs://your-bucket/staging"
./run_dataflowrunner.sh
```
