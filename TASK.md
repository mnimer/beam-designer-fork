# TASK.md — Code Review Findings

Principal-engineer review of `apache-beam-extension` (branch `develop`, clean tree @ `3571ba8`).
Scope: correctness, security, performance, maintainability. Style/formatting nits excluded.

**Verification status:** every finding below was confirmed by reading the cited lines. Items marked
🧪 **PoC verified** were reproduced by executing code. Findings that were *suspected but disproven*
are recorded in [Appendix: Investigated & Cleared](#appendix-investigated--cleared) so nobody re-litigates them.

---

## Task Index

**This table is the single source of truth for status.** Detail for each task is linked from its ID;
[Section 4](#4-actionable-remediation-plan) sequences the same tasks into execution phases.

`⬜ Not Started` · `🟦 In Progress` · `⏸️ Deferred` · `✅ Done` · `❌ Won't Fix`

> [!IMPORTANT]
> When a task's state changes, update **only** the Status cell below. Findings and plan steps
> deliberately carry no checkboxes so status can never disagree with itself.

> [!NOTE]
> **P1-P5 are cross-references**, not additional work — they restate M10/M11/M12/M18/M17
> from a performance viewpoint. Distinct remediation tasks: **34** (3 Critical, 21 Major, 8 Architecture, 2 Perf).
> Model evaluation task: **1** (E1). Integration pipeline test tasks: **20** (I1–I20). IO Connector expansion tasks: **79** (67 Built-in IO1–IO67, 12 Community IO68–IO79). Section 4 sequences these into execution phases.

| # | Sev | Label | Description | Status |
|---|-----|-------|-------------|--------|
| [C1](#c1) | 🔴 Critical | Path traversal in codegen writes | `../` sanitiser strips only *leading* segments; Gemini-supplied filenames can write executables anywhere on disk. **PoC verified.** | ✅ Done (`bc3feb1`) |
| [C2](#c2) | 🔴 Critical | Plaintext credentials persisted | JDBC/JMS passwords saved into the git-tracked `.beam` file, sent to Gemini, and written to `gemini.log`. | ✅ Done (`ef7df29`, `1b31779`) |
| [C3](#c3) | 🔴 Critical | Unsafe cleanup strategy | Wipes the target folder *before* the model call, over-deletes user files, and never removes `.venv`/`.gradle`. Needs ownership marker + allowlist. | ✅ Done (`6bce56a`) |
| [M1](#m1) | 🟠 Major | Duplicate `getSecrets` case | Second handler is unreachable dead code; the live one emits full resource paths instead of short secret IDs. | ✅ Done (`9aefa40`) |
| [M2](#m2) | 🟠 Major | No webview CSP | `enableScripts` with no CSP/nonce, plus `dangerouslySetInnerHTML` behind a hand-rolled escaper. | ✅ Done (`6e73cb9`) |
| [M3](#m3) | 🟠 Major | Terminal command injection | `outputFolder` interpolated unquoted into ``terminal.sendText(`cd "…"`)``. | ✅ Done (`bfaaa40`) |
| [M4](#m4) | 🟠 Major | Bypasses VS Code document model | `fs.writeFileSync` on an open `TextDocument`; the documented two-way sync is not implemented. | ✅ Done (`c33f43b`) |
| [M5](#m5) | 🟠 Major | Undisposed webview listeners | `onDidReceiveMessage` disposable discarded and no `onDidDispose`; leaks on every editor open. | ✅ Done (`c33f43b`) |
| [M6](#m6) | 🟠 Major | Silent CLI failures | ~12 handlers swallow errors and post empty arrays, so auth failures look like zero resources. | ✅ Done (`f9f1a97`, `618259d`) |
| [M7](#m7) | 🟠 Major | Hardcoded developer path | The author's local `google-cloud-sdk` path is the first candidate in `findGcloudPath()`. | ✅ Done (`bfaaa40`) |
| [M8](#m8) | 🟠 Major | Inconsistent CLI resolution | Only 3 of ~13 call sites use `findGcloudPath()`; the rest break when VS Code lacks the shell `PATH`. | ✅ Done (`f9f1a97`) |
| [M9](#m9) | 🟠 Major | Lint and test scripts broken | No root ESLint config, missing `runTest.js`, and a 0-byte test file breaks vitest. **Verified.** | ✅ Done (`90c2294`) |
| [M10](#m10) | 🟠 Major | O(n²) JSON repair | Backward `}` scan re-parses the entire string per candidate, blocking the extension host. | ✅ Done (`139fa18`) |
| [M11](#m11) | 🟠 Major | O(tokens × length) highlighter | Per-token full-string `replace`, unmemoised in JSX, plus `$`-pattern preview corruption. | ✅ Done (`a77c51d`) |
| [M12](#m12) | 🟠 Major | React Flow identity churn | `nodes.map()` inline in the prop builds new objects each render, defeating memoisation. | ✅ Done (`2e4c4f9`) |
| [M13](#m13) | 🟠 Major | Stale closure on folder refresh | Static dep array captures the initial `outputFolder`, so files are read from the wrong path. | ✅ Done (`2e4c4f9`) |
| [M14](#m14) | 🟠 Major | Label-based form dispatch | ~200-line if/else keyed on the user-editable node label; renaming loads the wrong form. | ✅ Done (`2e0cf40`) |
| [M15](#m15) | 🟠 Major | `gemini.log` shipped to Cloud Build | Generated `.gcloudignore` omits `*.log`, so the full prompt travels in the build context. | ✅ Done (`bfaaa40`) |
| [M16](#m16) | 🟠 Major | Partial edge rewiring | `findIndex` redirects only the first inbound edge when inserting a KV Mapper. | ✅ Done (`2e4c4f9`) |
| [M17](#m17) | 🟠 Major | Eager activation | `activationEvents: ["*"]` plus a workspace-wide `findFiles` on every window. | ✅ Done (`139fa18`) |
| [M18](#m18) | 🟠 Major | Blocking synchronous I/O | `fs.*Sync` on the autosave, codegen, and folder-walk hot paths in the extension host. | ✅ Done (`7cb0cd3`) |
| [M19](#m19) | 🟠 Major | `BigQueryIO` stale closure | Async `datasetsLoaded` spreads first-render props, erasing anything typed in the meantime. | ✅ Done (`64207c5`) |
| [M20](#m20) | 🟠 Major | Unnormalised secrets in Kinesis sink | Missing `.map(s => s.name)`; renders `[object Object]` the moment M1 is fixed. **Ship with M1.** | ✅ Done (`9aefa40`) |
| [M21](#m21) | 🟠 Major | Test gaps + orphaned test | No tests for Aggregations/Map/ParseMessage; `ElementTransforms.test.tsx` has no component. | ✅ Done (`0b03734`) |
| [A1](#a1) | 🔵 Architecture | 1,000-line message switch | `handleMessages` mixes GCP, AWS, file I/O, samples, terminal, and codegen. Untestable as written. | ✅ Done (`c4a5931`) |
| [A2](#a2) | 🔵 Architecture | 10 copy-pasted asset handlers | ~210 lines of identical exec→parse→post logic; collapse into a single `listAssets()`. | ✅ Done (`f9f1a97`) |
| [A3](#a3) | 🔵 Architecture | Monolithic codegen closure | 260-line block doing prompt, API, repair, routing, and writing; needs a `LanguageStrategy`. | ✅ Done (`a58c8c5`) |
| [A4](#a4) | 🔵 Architecture | DRY violation across 41 forms | 13,641 LOC with 163/171 duplicated class strings and 34 hand-rolled `handleChange` copies. | ✅ Done (`1564619`, `618259d`) |
| [A5](#a5) | 🔵 Architecture | Committed build artifacts | Stale `App.js` / `main.js` and their maps tracked beside their `.tsx` sources. | ✅ Done (`11567d8`) |
| [A6](#a6) | 🔵 Architecture | `App.tsx` is 1,232 lines | Owns canvas state, IPC, autosave, samples, and layout; extract into hooks. | ✅ Done (`f748242`) |
| [A7](#a7) | 🔵 Architecture | Model constant mismatch | `constants.ts` pins `gemini-3.5-flash`; project `GEMINI.md` mandates `gemini-3.7-flash`. | ✅ Done (`11567d8`) |
| [A8](#a8) | 🔵 Architecture | JSON created, YAML saved | New pipelines are written as JSON but silently rewritten as YAML on first edit. | ✅ Done (`139fa18`) |
| [P1](#p1) | 🟡 Perf | O(n²) JSON repair | Cross-reference — fixed by **M10**. | ✅ Done (`139fa18`) |
| [P2](#p2) | 🟡 Perf | Unmemoised highlighter | Cross-reference — fixed by **M11**. | ✅ Done (`a77c51d`) |
| [P3](#p3) | 🟡 Perf | React Flow re-render storm | Cross-reference — fixed by **M12**. | ✅ Done (`2e4c4f9`) |
| [P4](#p4) | 🟡 Perf | Synchronous `fs.*` hot paths | Cross-reference — fixed by **M18**. | ✅ Done (`7cb0cd3`) |
| [P5](#p5) | 🟡 Perf | Eager activation + broad scan | Cross-reference — fixed by **M17**. | ✅ Done (`139fa18`) |
| [P6](#p6) | 🟡 Perf | 1 s full-document YAML autosave | Whole graph re-serialised and rewritten to disk every second while editing. | ✅ Done (`f748242`) |
| [P7](#p7) | 🟡 Perf | Unmemoised `.filter()` in render | `BottomPanel` re-filters on every render; wrap in `useMemo`. *(Minor.)* | ✅ Done (`a77c51d`) |
| [E1](#e1) | 🟣 Feature | Multi-Agent E2E Evaluation & Prompt Feedback | Multi-agent evaluation harness (Beam, Security, Packaging, Arbiter) with deterministic syntax gate and prompt remediation generation for Python/Java. | ✅ Done (`525c262`) |
| [I1](#i1) | 🧪 Integration | `jdbcio-to-jdbcio` | Relational database ETL: PostgreSQL source ➔ ParDo ➔ MySQL sink. | ✅ Done (`7474752`) |
| [I2](#i2) | 🧪 Integration | `kafkaio-to-kafkaio` | Streaming message broker: KafkaIO source ➔ ParDo (try/catch DLQ) ➔ KafkaIO EOS sink + LogMessage sink. | ✅ Done (`7474752`) |
| [I3](#i3) | 🧪 Integration | `pubsub-to-bigquery` | GCP Cloud Analytics: PubSubIO subscription ➔ ParseMessage (JSON) ➔ BigQueryIO Storage Write API + DLQ error branch. | ✅ Done |
| [I4](#i4) | 🧪 Integration | `bigquery-to-parquet` | Data warehouse export: BigQueryIO SQL query source ➔ Map record projection ➔ ParquetIO Snappy columnar sink. | ✅ Done |
| [I5](#i5) | 🧪 Integration | `textio-wordcount` | Classic batch tokenization: TextIO source ➔ FlatMap tokenizer ➔ Filter ➔ KVMapper ➔ Count.perKey ➔ ToString ➔ TextIO sink. | ✅ Done |
| [I6](#i6) | 🧪 Integration | `generatesequence-pubsub-fixed` | Synthetic streaming & fixed windowing: GenerateSequence ➔ WithTimestamps ➔ WindowInto (Fixed 60s) ➔ KVMapper ➔ GroupByKey ➔ Sum ➔ PubSubIO sink. | ✅ Done |
| [I7](#i7) | 🧪 Integration | `kinesis-to-avro` | AWS streaming to object storage: KinesisIO (TRIM_HORIZON) ➔ ParseMessage ➔ AvroIO sink with schema & file sharding. | ✅ Done |
| [I8](#i8) | 🧪 Integration | `sqs-to-sns-filtered` | AWS queue-to-topic pub/sub: SqsIO source ➔ Filter predicate ➔ ParDo enrichment ➔ SnsIO topic sink. | ✅ Done |
| [I9](#i9) | 🧪 Integration | `mqtt-to-bigquery-sliding` | IoT telemetry & sliding windowing: MqttIO source ➔ ParseMessage (JSON) ➔ WindowInto (Sliding 5m/1m) ➔ Mean aggregation ➔ BigQueryIO sink. | ✅ Done |
| [I10](#i10) | 🧪 Integration | `jms-to-jms-batching` | Enterprise message broker batching: JmsIO queue source ➔ GroupIntoBatches (batch size 100) ➔ ParDo batch processor ➔ JmsIO queue sink. | ✅ Done |
| [I11](#i11) | 🧪 Integration | `fileio-dynamic-destinations` | Dynamic file partitioning: FileIO file-pattern reader ➔ ParDo dynamic partition categorization ➔ FileIO dynamic destinations. | ✅ Done |
| [I12](#i12) | 🧪 Integration | `avro-to-parquet-lakehouse` | Binary format migration: AvroIO source ➔ Map schema transformer ➔ ParquetIO sink with snappy compression. | ✅ Done |
| [I13](#i13) | 🧪 Integration | `periodic-impulse-to-jdbc` | Periodic trigger ETL: PeriodicImpulse interval source ➔ ParDo external API caller ➔ JdbcIO parameterized SQL insert statement sink. | ✅ Done |
| [I14](#i14) | 🧪 Integration | `create-aggregations-kv` | In-memory statistical transformations: Create source ➔ KVMapper ➔ Min/Max/Top/ApproximateQuantiles ➔ Keys/Values/KvSwap ➔ LogMessage sink. | ✅ Done |
| [I15](#i15) | 🧪 Integration | `pubsub-session-windows` | User session analytics: PubSubIO source ➔ WithTimestamps ➔ KVMapper (user_id) ➔ WindowInto (Session 10m gap) ➔ Count per session ➔ BigQueryIO sink. | ✅ Done |
| [I16](#i16) | 🧪 Integration | `multi-source-flatten-bigquery` | Multi-stream unification: PubSubIO source + KafkaIO source ➔ ParseMessage ➔ Flatten merge ➔ Reshuffle ➔ BigQueryIO sink. | ✅ Done |
| [I17](#i17) | 🧪 Integration | `cogroupbykey-relational-join` | Relational stream join: Create Orders + Create Customers ➔ KVMapper (customerId) ➔ CoGroupByKey join ➔ ParDo merger ➔ TextIO sink. | ✅ Done |
| [I18](#i18) | 🧪 Integration | `distinct-statistical-sampling` | Deduplication & sampling: TextIO source ➔ Distinct ➔ Sample ➔ ApproximateUnique ➔ LogMessage sink. | ✅ Done |
| [I19](#i19) | 🧪 Integration | `sns-to-sqs-fanout` | AWS notification fanout: SnsIO topic source ➔ ParDo unpacker ➔ SqsIO queue sink. | ✅ Done |
| [I20](#i20) | 🧪 Integration | `mqtt-to-mqtt-retained` | IoT broker routing & DLQ: MqttIO source ➔ ParDo alert detection with error branch ➔ MqttIO sink (QoS 1/retained) + LogMessage error sink. | ✅ Done |
| [IO1](#io1) | 🔌 Connector | FileIO | `FileIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO2](#io2) | 🔌 Connector | AvroIO | `AvroIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO3](#io3) | 🔌 Connector | TextIO (metrics) | `TextIO (metrics)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO4](#io4) | 🔌 Connector | TFRecordIO | `TFRecordIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO5](#io5) | 🔌 Connector | XmlIO | `XmlIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO6](#io6) | 🔌 Connector | TikaIO | `TikaIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO7](#io7) | 🔌 Connector | ParquetIO (guide) | `ParquetIO (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO8](#io8) | 🔌 Connector | ThriftIO | `ThriftIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO9](#io9) | 🔌 Connector | HadoopFileSystem | `HadoopFileSystem`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO10](#io10) | 🔌 Connector | GcsFileSystem (metrics) | `GcsFileSystem (metrics)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO11](#io11) | 🔌 Connector | LocalFileSystem | `LocalFileSystem`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO12](#io12) | 🔌 Connector | S3FileSystem | `S3FileSystem`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO13](#io13) | 🔌 Connector | In-memory | `In-memory`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO14](#io14) | 🔌 Connector | KinesisIO | `KinesisIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO15](#io15) | 🔌 Connector | AmqpIO | `AmqpIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO16](#io16) | 🔌 Connector | KafkaIO | `KafkaIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO17](#io17) | 🔌 Connector | PubSubIO | `PubSubIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO18](#io18) | 🔌 Connector | JmsIO | `JmsIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO19](#io19) | 🔌 Connector | MqttIO | `MqttIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO20](#io20) | 🔌 Connector | RabbitMqIO | `RabbitMqIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO21](#io21) | 🔌 Connector | SqsIO | `SqsIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO22](#io22) | 🔌 Connector | SnsIO | `SnsIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO23](#io23) | 🔌 Connector | CassandraIO | `CassandraIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO24](#io24) | 🔌 Connector | HadoopFormatIO (guide) | `HadoopFormatIO (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO25](#io25) | 🔌 Connector | HBaseIO | `HBaseIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO26](#io26) | 🔌 Connector | HCatalogIO (guide) | `HCatalogIO (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO27](#io27) | 🔌 Connector | KuduIO | `KuduIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO28](#io28) | 🔌 Connector | SolrIO | `SolrIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO29](#io29) | 🔌 Connector | ElasticsearchIO | `ElasticsearchIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO30](#io30) | 🔌 Connector | BigQueryIO (guide) (metrics) | `BigQueryIO (guide) (metrics)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO31](#io31) | 🔌 Connector | BigTableIO (metrics) | `BigTableIO (metrics)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO32](#io32) | 🔌 Connector | DatastoreIO | `DatastoreIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO33](#io33) | 🔌 Connector | SnowflakeIO (guide) | `SnowflakeIO (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO34](#io34) | 🔌 Connector | SpannerIO | `SpannerIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO35](#io35) | 🔌 Connector | JdbcIO | `JdbcIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO36](#io36) | 🔌 Connector | DebeziumIO | `DebeziumIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO37](#io37) | 🔌 Connector | MongoDbIO | `MongoDbIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO38](#io38) | 🔌 Connector | MongoDbGridFSIO | `MongoDbGridFSIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO39](#io39) | 🔌 Connector | RedisIO | `RedisIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO40](#io40) | 🔌 Connector | DynamoDBIO | `DynamoDBIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO41](#io41) | 🔌 Connector | ClickHouseIO | `ClickHouseIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO42](#io42) | 🔌 Connector | ArrowFlightIO | `ArrowFlightIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO43](#io43) | 🔌 Connector | DatabaseIO | `DatabaseIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO44](#io44) | 🔌 Connector | GenerateSequence | `GenerateSequence`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO45](#io45) | 🔌 Connector | SplunkIO | `SplunkIO`: 1 Sink (writer) node + property panel + integration test (`SOURCE:SplunkIO` skipped — native `SplunkIO.Write` HEC sink only). || ✅ Done |
| [IO46](#io46) | 🔌 Connector | FhirIO | `FhirIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO47](#io47) | 🔌 Connector | HL7v2IO | `HL7v2IO`: 1 Source (reader) node + 1 Sink (writer) node (`BATCH_IMPORT` excluded per Beam JavaDoc) + property panels + integration test. || ✅ Done |
| [IO48](#io48) | 🔌 Connector | DicomIO | `DicomIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO49](#io49) | 🔌 Connector | FlinkStreamingImpulseSource | `FlinkStreamingImpulseSource`: 1 Source (reader) node (no native writer support) + property panel + integration test. || ✅ Done |
| [IO50](#io50) | 🔌 Connector | Firestore IO | `Firestore IO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO51](#io51) | 🔌 Connector | Neo4j | `Neo4j`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO52](#io52) | 🔌 Connector | InfluxDB | `InfluxDB`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO53](#io53) | 🔌 Connector | SparkReceiverIO (guide) | `SparkReceiverIO (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO54](#io54) | 🔌 Connector | CdapIO (guide) | `CdapIO (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO55](#io55) | 🔌 Connector | SingleStoreDB (guide) | `SingleStoreDB (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO56](#io56) | 🔌 Connector | GoogleAdsIO | `GoogleAdsIO`: 1 Source (reader) node + property panel + integration test (`SINK:GoogleAdsIO` skipped — native `Read`/`ReadAll` GAQL source only). || ✅ Done |
| [IO57](#io57) | 🔌 Connector | Web APIs (guide) | `Web APIs (guide)` (`RequestResponseIO`): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO58](#io58) | 🔌 Connector | Iceberg (guide) | `Iceberg (guide)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO59](#io59) | 🔌 Connector | CsvIO | `CsvIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO60](#io60) | 🔌 Connector | JsonIO | `JsonIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO61](#io61) | 🔌 Connector | ContextualTextIO | `ContextualTextIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO62](#io62) | 🔌 Connector | PulsarIO | `PulsarIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO63](#io63) | 🔌 Connector | SolaceIO | `SolaceIO`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO64](#io64) | 🔌 Connector | DatadogIO | `DatadogIO`: 1 Sink (writer) node + property panel + integration test (`SOURCE:DatadogIO` skipped — native `DatadogIO.Write`/`DatadogWrite` sink only). || ✅ Done |
| [IO65](#io65) | 🔌 Connector | CosmosIO (Azure Cosmos DB) | `CosmosIO (Azure Cosmos DB)`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO66](#io66) | 🔌 Connector | AzureBlobStoreFileSystem | `AzureBlobStoreFileSystem`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ✅ Done |
| [IO67](#io67) | 🔌 Connector | Delta Lake | `Delta Lake`: 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⏭️ SKIPPED |
| [IO68](#io68) | 🔌 Connector | Cloud Bigtable (HBase based) | `Cloud Bigtable (HBase based)` (Java): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO69](#io69) | 🔌 Connector | Cognite Data Fusion | `Cognite Data Fusion` (Java): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO70](#io70) | 🔌 Connector | KineticaDB | `KineticaDB` (Java): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO71](#io71) | 🔌 Connector | SAP Hana to Google BigQuery | `SAP Hana to Google BigQuery` (Java): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO72](#io72) | 🔌 Connector | TrepWsIO | `TrepWsIO` (Java): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO73](#io73) | 🔌 Connector | Beam PyIO (Collection of Python IO connectors) | `Beam PyIO (Collection of Python IO connectors)` (Python): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO74](#io74) | 🔌 Connector | Cloud SQL | `Cloud SQL` (Python): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO75](#io75) | 🔌 Connector | MySQL | `MySQL` (Python): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO76](#io76) | 🔌 Connector | Pyodbc | `Pyodbc` (Python): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO77](#io77) | 🔌 Connector | Tinybird | `Tinybird` (Python): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO78](#io78) | 🔌 Connector | Go Connect | `Go Connect` (Go): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |
| [IO79](#io79) | 🔌 Connector | MySQL, PostgreSQL, Oracle, SQL Server | `MySQL, PostgreSQL, Oracle, SQL Server` (Yaml): 1 Source (reader) node + 1 Sink (writer) node + property panels + integration test. || ⬜ Not Started |

---

## 1. Critical Findings (Must-Fix)

### [Critical]

- <a id="c1"></a>**C1 — Arbitrary file write + `chmod 755` outside the workspace via LLM-controlled filenames.**
  🧪 **PoC verified.**
  [extension.ts:1911](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1911)
  sanitises the model-supplied filename with `normalizedFilename.replace(/^(\.\.[\/\\])+/, '')`, which
  only strips **leading** `../` sequences. A `..` appearing after any path segment survives, and the
  result is passed straight to `path.join(targetFolderPath, normalizedFilename)` +
  `fs.writeFileSync` at [extension.ts:1966-1971](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1966-L1971),
  then `fs.chmodSync(filePath, '755')` when `file.executable` is set
  ([extension.ts:1973-1979](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1973-L1979)).
  Executed against target `/Users/me/ws/mypipeline`:
  ```
  "../../../../tmp/pwned.sh"            -> /Users/me/ws/mypipeline/tmp/pwned.sh   (blocked)
  "src/../../../../tmp/pwned.sh"        -> /Users/tmp/pwned.sh                    (ESCAPED)
  "a/b/../../../../../../tmp/pwned.sh"  -> /tmp/pwned.sh                          (ESCAPED)
  ```
  The filename originates from Gemini's JSON output, which is steered by the `.beam` pipeline content
  embedded in the prompt ([extension.ts:1848](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1848)).
  A malicious/shared `.beam` file is therefore a prompt-injection path to **writing an executable file
  anywhere the VS Code process can write** (e.g. `~/.zshrc`, `~/Library/LaunchAgents`).
  **Fix:** resolve then assert containment before every write; never trust the model for paths.
  ```ts
  const filePath = path.resolve(targetFolderPath, normalizedFilename);
  const rel = path.relative(targetFolderPath, filePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      console.error(`[regenerateCode] Rejected out-of-bounds file: ${file.filename}`);
      continue;
  }
  ```
  Also gate `chmod 755` to an allowlist of expected script names rather than a model-controlled boolean.

- <a id="c2"></a>**C2 — Plaintext database/broker passwords are persisted to the `.beam` file, committed to git, and transmitted to Gemini.**
  Password inputs write straight into node properties via the shared `handleChange`:
  [source/JdbcIO.tsx:264-272](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/source/JdbcIO.tsx#L264-L272),
  [sink/JdbcIO.tsx:209](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/sink/JdbcIO.tsx#L209),
  [source/JmsIO.tsx:518](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/source/JmsIO.tsx#L518),
  [sink/JmsIO.tsx:518](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/sink/JmsIO.tsx#L518).
  That state is `YAML.stringify`'d wholesale into the document
  ([App.tsx:329-343](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L329-L343))
  and written to the `.beam` file. **`.beam` is not gitignored**, so credentials land in source control.
  The same YAML is then interpolated into the Gemini prompt
  ([extension.ts:1848](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1848))
  and the **full prompt is written verbatim to `gemini.log`**
  ([extension.ts:1874, 1883](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1874-L1883)).
  **Fix:** these four fields must store a Secret Manager *reference* only (the `secretManager` auth mode
  already exists in 6 other components — reuse it). Redact any `password`/`secret`/`accessKey` value
  before it enters the prompt or the log. Add `*.beam` credential linting to CI.

- <a id="c3"></a>**C3 — Destructive delete runs *before* code generation → unrecoverable loss of user files on any failure.**
  [extension.ts:1810](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1810)
  calls `deleteCodeFiles(targetFolderPath)` **before** the Gemini request at
  [extension.ts:1859](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1859).
  `deleteCodeFiles` ([extension.ts:880-930](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L880-L930))
  recursively removes **every** non-hidden entry except `*.beam` — including hand-written README,
  `metadata.json`, `*.tf`, and any user edits. Its only guard is "inside the workspace and not the
  workspace root", so pointing *Target Folder* at an existing project directory (trivially done via the
  folder picker) wipes it. If the API call then times out, is rate-limited, or returns unparseable JSON,
  the user is left with nothing and no backup.

  **Additionally, the current filter is wrong in *both* directions.**
  [extension.ts:904](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L904)
  skips every dot-prefixed entry:
  ```ts
  if (item.startsWith('.') && item !== '.dockerignore' && item !== '.gcloudignore') continue;
  ```
  | Entry | Today | Desired |
  |---|---|---|
  | `.venv`, `.gradle`, `.pytest_cache`, `.mypy_cache` | **never deleted** (dot-prefixed) | delete on language switch |
  | `target/`, `__pycache__`, `node_modules/` | deleted every regen | delete on language switch only |
  | user's `README.md`, `metadata.json`, `*.tf` | **deleted every regen** | never delete |

  So it *under*-deletes exactly the dependency folders that must go on a Python↔Java switch, while
  *over*-deleting hand-written user files. The root cause is the strategy: it `readdir`s the folder and
  denylists a few exceptions. It must instead **allowlist what we know we created.**

  **Fix — four layers. A manifest alone is *not* sufficient (see rationale in each layer).**

  1. **Reorder (fixes the data-loss window).** Delete *after* a validated payload is in memory, not
     before the API call. A temp-dir-and-swap is unnecessary complexity here — plain reordering gives the
     same atomicity with no cross-device-rename or partial-swap failure modes:
     `resolve+gate → generate → validate all paths (C1) → clean → write`.
  2. **Ownership marker (fixes the retarget hazard).** A manifest says *which files*; it does not say
     *whose folder this is*. Write `.beamgen.json` into the output folder holding
     `{schemaVersion, pipelineId, language, generatedAt, files:[{path, sha256}]}`, and add a stable
     `pipelineId` to `pipelineConfig` — **none exists today**
     ([extension.ts:70-87](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L70-L87)),
     so it must be generated at creation and backfilled on first save.
  3. **Gate before any deletion.** This is the answer to "can't the user still mess it up by changing the
     target dir?" — yes, unless retargeting is explicitly detected:
     | Marker | Folder | Action |
     |---|---|---|
     | absent | empty | proceed (fresh folder) |
     | absent | **non-empty** | **prompt, never auto-delete** — *"Not created by the designer (N files). [Generate without cleaning] [Pick another folder] [Cancel]"* |
     | present, `pipelineId` mismatch | any | prompt (two pipelines share one folder) |
     | present, matches | any | clean per layer 4 |
  4. **Scope deletion by scenario** — and *only* inside a folder that passed layer 3:
     - **Same-language regen:** delete manifest entries only. **Keep `.venv`/`target`** — wiping them on
       every generation costs the user a full `pip install`/Maven resolve for no benefit.
     - **Language switch** (`manifest.language !== requested`): manifest entries **+** the build-artifact
       allowlist **+** the other language's descriptors (`pom.xml`, `requirements.txt`, `src/main/java/`).
       This is the only path that removes dependency folders, which is what you actually want.
     - **Build-artifact allowlist** (exact names, owned folders only): `.venv`, `venv`, `env`,
       `__pycache__`, `.pytest_cache`, `.mypy_cache`, `*.egg-info`, `target`, `.gradle`, `build`, `out`,
       `node_modules`.
     - **Hash check:** if a manifest file's current `sha256` differs, the user hand-edited generated code.
       Overwriting is documented behaviour, so proceed — but list the modified files in the output channel
       so they can recover from git.
     - **In-use guard:** deleting `.venv` while the *Apache Beam Runner* terminal has it activated breaks
       that shell. Warn (or skip) if that terminal is live.

  **Residual risk this cannot eliminate:** once a folder is designer-owned, a user who later stores their
  own work *in that same folder* is still exposed. Layer 4 contains the blast radius — we only ever remove
  manifest entries and known build artifacts, never "everything in the directory" — so unknown user files
  survive by default. That property is the real fix, and it is what a manifest *alone* does not give you.

---

### [Major]

- <a id="m1"></a>**M1 — Duplicate `case 'getSecrets'`: the second handler is unreachable dead code, and the live one returns the wrong data shape.**
  `handleMessages` has two `case 'getSecrets':` labels in the same `switch`:
  [extension.ts:1168](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1168)
  and [extension.ts:1274](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1274).
  JS dispatches to the **first**, so the second is permanently dead.
  The live handler returns raw `s.name` — the *fully-qualified* resource path
  (`projects/123456/secrets/my-secret`). The dead one does
  `nameParts[nameParts.length - 1]` to produce the short ID and richer `{name,id,fullName,value}` objects —
  i.e. it was written specifically to fix this, but never runs.
  Consumers such as
  [source/KinesisIO.tsx:136](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/source/KinesisIO.tsx#L136)
  (`typeof s === 'string' ? s : s.name`) therefore populate the dropdown with full resource paths, and
  that path is what gets baked into the generated pipeline as the secret ID → **runtime failure in the
  deployed Dataflow job**, with no error at design time.
  **Fix:** delete the handler at 1168, keep 1274. Add ESLint `no-duplicate-case` (see M9) so this class
  of bug is caught mechanically.

- <a id="m2"></a>**M2 — Webview has no Content-Security-Policy, and renders code through `dangerouslySetInnerHTML`.**
  [extension.ts:1062-1068](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1062-L1068)
  sets `enableScripts: true` and assigns `webview.html` from the built `index.html`, which contains **no
  CSP `<meta>` tag** (confirmed: zero matches for `Content-Security-Policy`/`nonce` across the repo).
  Meanwhile [SourceCodeTab.tsx:282-288](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/BottomPanel/SourceCodeTab.tsx#L282-L288)
  injects the output of a hand-rolled regex highlighter as raw HTML.
  *Assessed honestly:* `highlightCode` **does** escape `&`, `<`, `>` first
  ([SourceCodeTab.tsx:62-65](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/BottomPanel/SourceCodeTab.tsx#L62-L65)),
  so I could **not** construct a working tag-injection payload — this is *not* a proven XSS today.
  It is nonetheless Major because the only thing standing between untrusted model output and script
  execution in a privileged webview is three hand-written `.replace()` calls, with **no CSP as a second
  line of defence**. Absent CSP the webview may also load arbitrary remote scripts/images (exfiltration channel).
  **Fix:** (a) inject a strict CSP with a per-load nonce (`default-src 'none'; script-src 'nonce-…'; style-src ${cspSource}`);
  (b) replace the bespoke highlighter with Prism/`highlight.js` rendering to React elements, dropping `dangerouslySetInnerHTML`.

- <a id="m3"></a>**M3 — Shell command injection into the integrated terminal via `outputFolder`.**
  [extension.ts:1756](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1756):
  ```ts
  terminal.sendText(`cd "${folderPath}" && ./${scriptName}`);
  ```
  `folderPath` derives from `message.pipelineConfig?.outputFolder`
  ([extension.ts:1709-1719](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1709-L1719)),
  which comes from the `.beam` document. A value containing `"` escapes the quoting and appends arbitrary
  commands. *Precondition (stated honestly):* the `scriptExists` check at
  [extension.ts:1735-1742](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1735-L1742)
  means a directory with that literal name must exist — achievable in a malicious repo, since POSIX
  directory names may contain `"` and `;`. Requires the user to click Run.
  **Fix:** the terminal is already created with `cwd: folderPath`; drop the `cd` entirely, or shell-quote
  via `'` + `replace(/'/g, `'\\''`)`. Reject `outputFolder` values containing shell metacharacters.

- <a id="m4"></a>**M4 — Extension writes the open document straight to disk, bypassing the VS Code document model.**
  `BeamEditorProvider` is a `CustomTextEditorProvider`, but `savePipeline` calls
  `fs.writeFileSync(targetUri.fsPath, …)` ([extension.ts:952](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L952))
  on a file VS Code currently holds open as a `TextDocument`. This desynchronises the in-memory document
  from disk, produces spurious "file changed on disk" conflicts, and breaks undo/dirty state.
  Compounding it, [resolveCustomTextEditor](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1042-L1074)
  registers **no `onDidChangeTextDocument`** listener, so the class doc's claim of *"two-way
  synchronization of .beam files"* ([extension.ts:20](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L20))
  is not implemented — editing the `.beam` in the text editor never updates the canvas.
  **Fix:** persist via `vscode.WorkspaceEdit`/`applyEdit`, and subscribe to `onDidChangeTextDocument`
  (filtering on `e.document.uri`) to push updates into the webview.

- <a id="m5"></a>**M5 — Webview message listener and panel are never disposed (resource leak).**
  [extension.ts:1071-1073](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1071-L1073)
  discards the `Disposable` returned by `webview.onDidReceiveMessage(...)`, and there is no
  `webviewPanel.onDidDispose(...)` handler. Every open/close of a `.beam` editor leaks a listener that
  still holds `context` and `document`; in-flight `execFile` callbacks then `postMessage` to a disposed
  webview.
  **Fix:** collect disposables, register `webviewPanel.onDidDispose(() => disposables.forEach(d => d.dispose()))`,
  and guard `postMessage` with a disposed flag.

- <a id="m6"></a>**M6 — Every GCP CLI failure is swallowed and surfaced as an empty dropdown.**
  All ~12 asset-discovery handlers follow the same shape: log to `console.error`, then
  `postMessage({ …, items: [] })`. Examples:
  [getDatasets:1091-1107](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1091-L1107),
  [getTopics:1132-1149](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1132-L1149),
  [getNetworks:1186-1207](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1186-L1207),
  [getComputeInstances:1319-1348](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1319-L1348).
  "Not authenticated", "API disabled", "wrong project" and "genuinely zero resources" are indistinguishable
  to the user, and `console.error` in the extension host is invisible without opening the dev tools.
  This directly contradicts the project rule *"do not add undocumented fallbacks … fail fast instead."*
  **Fix:** add an `error` field to every `*Loaded` message (the `runningJobsLoaded` handler at
  [1660-1665](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1660-L1665)
  already models this correctly) and render it inline in the picker.

- <a id="m7"></a>**M7 — Hardcoded developer-specific absolute path shipped in the extension.**
  [extension.ts:599](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L599):
  ```ts
  '/Users/mikenimer/Development/libraries/google-cloud-sdk/bin/gcloud',
  ```
  is the first candidate in `findGcloudPath()`. Dead weight for every other user and a leak of the
  author's local layout into a published VSIX.
  **Fix:** delete the line; resolve from `PATH`, then a `dataflowDesigner.gcloudPath` setting.

- <a id="m8"></a>**M8 — `gcloud`/`bq` resolution is inconsistent, breaking asset discovery on GUI-launched VS Code.**
  Only 3 call sites use `findGcloudPath()`
  ([262](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L262),
  [1169](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1169),
  [1639](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1639)).
  The other ~10 invoke bare `'gcloud'`, `'bq'`, `'gsutil'`, `'aws'`. On macOS, VS Code launched from
  Finder/Dock does not inherit the shell `PATH`, so those `execFile` calls fail with `ENOENT` → and per
  M6 the user just sees empty lists.
  **Fix:** route every CLI invocation through one resolver (`resolveCli('gcloud'|'bq'|'gsutil'|'aws')`)
  and surface a single actionable "CLI not found" error.

- <a id="m9"></a>**M9 — `npm run lint` and `npm test` are both broken; the duplicate-case bug (M1) went undetected as a result.**
  🧪 **Verified by execution.**
  - `npx eslint src --ext ts` → *"ESLint couldn't find a configuration file."* There is no root
    `.eslintrc*` / `eslint.config.js` (only `webview/eslint.config.js`).
  - `pretest` = `compile && lint`, so **`npm test` can never run**.
  - `npm test` = `node ./out/test/runTest.js`; that file does not exist and no `src/test/runTest.ts`
    exists to produce it.
  - [src/test/error-handling.test.ts](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/test/error-handling.test.ts)
    is **0 bytes** but matches the vitest `include` glob → vitest fails the run with "No test suite found".
  - `vitest.config.mts` mixes real-Gemini integration tests (180 s timeouts, live billable API, requires
    gcloud auth) into the default `test:integration` run.
  - Root vitest does **not** cover the ~45 webview test files (separate `webview` project); there is no
    single command that runs everything.
  **Fix:** add a root `eslint.config.js` enabling `no-duplicate-case`, `no-fallthrough`, `no-unused-vars`;
  delete or populate the empty test file; split `test:unit` from `test:integration`; add a root script
  that runs both projects. `tsc -p ./ --noEmit` passes cleanly today — keep it that way in CI.

- <a id="m10"></a>**M10 — `parseOrRepairJson` is O(n²) on large truncated responses.**
  [extension.ts:568-587](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L568-L587)
  walks backwards through every `}` and calls `JSON.parse` on a fresh substring each iteration. Generated
  payloads are routinely 50-200 KB with thousands of `}`, so a truncated response costs thousands of
  full-string parses — seconds of blocked event loop in the extension host, right after the user already
  waited on the model.
  **Fix:** track brace depth in a single forward pass to find the last complete element of `files`, then
  parse once. Better: request `maxOutputTokens` explicitly and treat truncation as a hard error.

- <a id="m11"></a>**M11 — `highlightCode` is O(tokens × length) and re-runs on every render.**
  [SourceCodeTab.tsx:100-103](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/BottomPanel/SourceCodeTab.tsx#L100-L103)
  performs one full-string `.replace()` **per token** to re-insert placeholders; with thousands of tokens
  in a large generated file this is tens of millions of character scans. It is called inline in JSX at
  [SourceCodeTab.tsx:283](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/BottomPanel/SourceCodeTab.tsx#L283)
  with no `useMemo`, so it re-runs on **every** parent re-render — including each keystroke elsewhere in the panel.
  Separately, a real correctness bug: the replacement string is passed to `String.replace`, so `$&`,
  `` $` ``, `$'`, `$1` inside generated code are interpreted as **special replacement patterns** and corrupt
  the preview (e.g. a Python string `"cost: $& tax"`).
  **Fix:** single-pass tokenise+join (no repeated `replace`), use a replacer *function* to neutralise `$`
  patterns, and wrap the call in `useMemo([code, fileName, language])`.

- <a id="m12"></a>**M12 — React Flow node identity is destroyed on every render.**
  [App.tsx:1113-1119](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L1113-L1119)
  builds brand-new node objects (and new `data` objects) inline in the `nodes` prop. React Flow memoises
  on node reference, so this defeats it entirely and re-renders every node on any state change — visibly
  janky while dragging on medium/large graphs.
  **Fix:** attach `onLabelChange` once at node-creation time, or expose it via context so `data` stays
  referentially stable; pass `nodes` straight through.

- <a id="m13"></a>**M13 — Stale closure sends folder refresh to the wrong directory.**
  The IPC `handleMessage` effect ([App.tsx:358-497](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L358-L497))
  has a static dependency array, so the `refreshFolderFiles` it calls on `codeRegenerated`
  ([App.tsx:441](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L441))
  is the **first-render** instance, which captured `pipelineConfig.outputFolder === ''`
  (`refreshFolderFiles` is `useCallback(..., [pipelineConfig.outputFolder])` at
  [App.tsx:317-321](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L317-L321)).
  After generating into a non-default folder, the file list is read from the wrong path.
  **Fix:** read the folder from a ref (`pipelineConfigRef.current.outputFolder`) inside the handler.

- <a id="m14"></a>**M14 — `PropertyForm` dispatches on the user-editable node label.**
  [PropertyForm.tsx:71-265](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/PropertyForm.tsx#L71-L265)
  is a ~200-line `if/else` chain matching substrings of `label` (e.g. `label.includes('PubSub')`).
  Renaming a node to something containing a connector name silently swaps in the wrong property form and
  corrupts that node's configuration.
  **Fix:** dispatch from immutable `beam_transform`/`componentType` metadata via a
  `Record<string, React.FC>` registry; never from the display label.

- <a id="m15"></a>**M15 — `gemini.log` (full prompt, incl. any plaintext credentials) is uploaded to Cloud Build.**
  The generated `.gcloudignore`/`.dockerignore`
  ([extension.ts:2036-2043](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L2036-L2043))
  list `.git .venv node_modules __pycache__ target/ *.beam *.tf` but **not `*.log`**, while
  [run_dataflowrunner.sh](file:///Users/mikenimer/Development/projects/apache-beam-designer/resources/templates/python/run_dataflowrunner.sh)
  runs `gcloud builds submit --tag "${TEMPLATE_IMAGE}" .` — uploading the whole folder, `gemini.log` included,
  to Cloud Build/GCS. (Root `.gitignore` does cover `*.log`, so git is safe; the build context is not.)
  **Fix:** add `*.log` and `gemini.log` to both ignore files, and stop logging the raw prompt (see C2).

- <a id="m16"></a>**M16 — Edge redirection only rewires the first incoming edge.**
  [App.tsx:804-817](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L804-L817)
  uses `edges.findIndex(e => e.target === windowNodeId)` when inserting a KV Mapper. With multiple inbound
  edges the remaining ones keep pointing at the old node, silently producing a wrong DAG — which is then
  handed to Gemini as the spec.
  **Fix:** `edges.filter(...)`/`map(...)` to redirect **all** matching edges.

- <a id="m17"></a>**M17 — `activationEvents: ["*"]` forces eager activation.**
  [package.json:13-15](file:///Users/mikenimer/Development/projects/apache-beam-designer/package.json#L13-L15).
  The extension boots on every window, and `DataFlowTreeProvider`'s constructor immediately runs
  `scanPipelines()` → `workspace.findFiles('**/*.beam')`
  ([extension.ts:197-215](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L197-L215))
  across the entire workspace, even for users who never open a `.beam` file.
  **Fix:** `onCustomEditor:dataflow-pipeline-builder.beamEditor`, `onView:dataflowExplorer`, plus the
  explicit command IDs. Exclude `**/node_modules/**` from `findFiles`.

- <a id="m18"></a>**M18 — Blocking synchronous I/O throughout the extension host.**
  `fs.writeFileSync`/`readFileSync`/`readdirSync`/`statSync`/`existsSync` are used on every hot path —
  autosave ([952](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L952)),
  per-file codegen writes ([1971](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1971)),
  recursive folder walk ([1539-1555](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1539-L1555)),
  sample loading ([800-847](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L800-L847)).
  Combined with the 1 s autosave debounce ([App.tsx:327-346](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L327-L346))
  the UI thread stalls on disk during editing.
  **Fix:** migrate to `fs.promises` / `vscode.workspace.fs`.

- <a id="m19"></a>**M19 — Stale closure in `BigQueryIO` silently erases user input.**
  [source/BigQueryIO.tsx:45-65](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/source/BigQueryIO.tsx#L45-L65)
  (and the twin at [sink/BigQueryIO.tsx:42-61](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/sink/BigQueryIO.tsx#L42-L61))
  registers a `message` listener in a `useEffect` with an **empty dependency array**, so `handleMessage`
  permanently captures the *first-render* `properties` object
  ([line 40](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/source/BigQueryIO.tsx#L40)).
  When the async `datasetsLoaded` reply arrives it executes:
  ```ts
  onChange({ ...properties, projectId: message.projectId });   // line 51 — `properties` is stale
  ```
  Anything the user typed between mount and the `bq ls` response (typically 1-3 s) is **reverted**.
  Worse, `datasetsLoaded` is a broadcast on `window`, so *any* component triggering `getDatasets` resets
  *every* mounted BigQueryIO form.
  **Fix:** keep `properties` in a ref (`propertiesRef.current = properties` each render) and read
  `propertiesRef.current` inside the handler before calling `onChange`.

- <a id="m20"></a>**M20 — `sink/KinesisIO` does not normalise the secrets payload — latent `[object Object]`, and it breaks the moment M1 is fixed.**
  ⚠️ **Read together with M1 before touching either.**
  [source/KinesisIO.tsx:136](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/source/KinesisIO.tsx#L136)
  defensively normalises: `rawSecrets.map(s => typeof s === 'string' ? s : s.name)`.
  Its sibling [sink/KinesisIO.tsx:131](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/sink/KinesisIO.tsx#L131)
  omits it entirely — `setSecrets(message.secrets || [])` — then renders the values directly at
  [sink/KinesisIO.tsx:370-372](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/sink/KinesisIO.tsx#L370-L372):
  ```tsx
  {secrets.map((sec) => (<option key={sec} value={sec} />))}
  ```
  **It works today only by accident:** the *live* `getSecrets` handler
  ([extension.ts:1168](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1168))
  emits an array of **strings**. The dead handler at
  [1274](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1274)
  emits **objects**. So if M1 is fixed the obvious way — delete the first handler, keep the correct
  second one — this sink immediately renders `[object Object]` in the dropdown and writes that string
  into the pipeline.
  **Fix:** normalise in `sink/KinesisIO.tsx` **in the same commit** as M1, and audit the other 13
  `secretsLoaded` listeners for the same omission. This is exactly the drift predicted by A4.

- <a id="m21"></a>**M21 — Test-coverage gaps and an orphaned test file.**
  No sibling test exists for
  [step/Aggregations.tsx](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/step/Aggregations.tsx),
  [step/Map.tsx](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/step/Map.tsx), or
  [step/ParseMessage.tsx](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/step/ParseMessage.tsx),
  against a project standard of 100% coverage. Conversely,
  [step/ElementTransforms.test.tsx](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/properties/step/ElementTransforms.test.tsx)
  tests an `ElementTransforms.tsx` that **does not exist** — either a deleted component whose test was
  left behind, or a component missing from a commit. Resolve which, then add the three missing suites.

---

## 2. Architecture & Code Quality

- <a id="a1"></a>**A1 — `handleMessages` is a ~1,000-line switch: the single largest SRP breach in the codebase.**
  [extension.ts:1081-2077](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1081-L2077)
  is one function handling GCP asset discovery, AWS discovery, file I/O, save dialogs, sample management,
  terminal execution, and the whole Gemini codegen pipeline. It is untestable in isolation (no seam for
  mocking `execFile`), and it is exactly where M1's duplicate `case` hid.
  **Fix:** replace with a handler registry `Record<string, (msg, ctx) => Promise<void>>` split into
  `src/handlers/gcpAssets.ts`, `fileSystem.ts`, `samples.ts`, `codegen.ts`, `runner.ts`. A registry makes
  duplicate keys impossible by construction.

- <a id="a2"></a>**A2 — The 10 asset-discovery handlers are the same function copy-pasted 10 times.**
  `getDatasets`/`getTables`/`getTopics`/`getSubscriptions`/`getSecrets`/`getNetworks`/`getSubnetworks`/
  `getStorageBuckets`/`getAwsQueues`/`getComputeInstances` all implement: exec CLI → on error log+post empty →
  `JSON.parse` → map → post. ~210 lines that should be ~30.
  **Fix:**
  ```ts
  async function listAssets<T>(cli: string, args: string[], map: (json: any) => T[],
                               responseCommand: string, key: string) { /* one impl, real errors */ }
  ```
  This fixes M6 and M8 in one place for all ten.

- <a id="a3"></a>**A3 — Extract the Gemini codegen pipeline out of the message handler.**
  [extension.ts:1812-2073](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1812-L2073)
  is a single 260-line closure doing prompt assembly, API call, logging, JSON repair, filename
  normalisation, language filtering, path routing, content rewriting, file writing, chmod, and main-file
  detection. The Java/Python routing blocks at
  [1933-1954](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1933-L1954)
  and the near-identical main-file detection at
  [1983-2002](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1983-L2002)
  are parallel implementations that will drift.
  **Fix:** `CodeGenerator` class + a `LanguageStrategy` interface (`JavaStrategy`/`PythonStrategy`) exposing
  `normalizePath()`, `isMainFile()`, `shouldSkip()`. Makes each unit testable without calling the model.

- <a id="a4"></a>**A4 — Severe DRY violation across 41 property components (13,641 LOC). Measured, not estimated:**
  | Duplicated pattern | Occurrences |
  |---|---|
  | Identical Tailwind `<input>` class string | **163** |
  | Identical Tailwind `<label>` class string | **171** |
  | Hand-rolled `const handleChange` | **34 / 41 files** |
  | Raw `window.addEventListener('message', …)` IPC block | **14 files** |
  | Manual `onChange({...})` parent-sync block | **38 files** |
  | Duplicated Secret Manager auth-mode UI | **6 files** |

  Every one of these is a place M1-style drift can hide, and it is why sink/source siblings diverge.
  **Fix (highest maintainability ROI in the repo):**
  1. `<PropertyField label icon tooltip type value onChange/>` — collapses the 163+171 class-string copies
     and centralises the 8pt-grid styling the project standard requires.
  2. `useExtensionMessage(command, handler)` hook — one listener with guaranteed `removeEventListener`
     cleanup, replacing 14 hand-written effects.
  3. `useAssetLoader('secrets'|'buckets'|'topics')` — request + loading + error state, once.
  4. `<SecretManagerAuthFields/>` — the 6-file credential block, and the enforcement point for C2.
  Realistic outcome: **13.6k → ~4-5k LOC** with materially better consistency.

- <a id="a5"></a>**A5 — Dead compiled artifacts committed inside the source tree.**
  `git ls-files` shows
  [App.js](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.js),
  [App.js.map](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.js.map),
  [main.js](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/main.js),
  [main.js.map](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/main.js.map)
  tracked next to their `.tsx` sources. Stale duplicates that confuse search/navigation.
  **Fix:** `git rm --cached` them; add `webview/src/**/*.js{,.map}` to `.gitignore`.

- <a id="a6"></a>**A6 — `App.tsx` (1,232 lines) should be decomposed.**
  It owns canvas state, IPC, autosave, samples, node/edge mutation helpers, and layout.
  **Fix:** extract `useVsCodeBridge()` (IPC + `ready` handshake), `usePipelinePersistence()` (YAML +
  debounced save), `usePipelineGraph()` (node/edge mutations incl. the M16 fix), leaving `App.tsx` as composition.

- <a id="a7"></a>**A7 — Model constant contradicts the project's own standard.**
  [constants.ts:4](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/constants.ts#L4)
  pins `gemini-3.5-flash`, while
  [.gemini/GEMINI.md:13](file:///Users/mikenimer/Development/projects/apache-beam-designer/.gemini/GEMINI.md#L13)
  mandates `gemini-3.7-flash` (Recommended). One of the two is wrong — reconcile deliberately.
  *(Note: `location: 'global'` at [extension.ts:1825](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1825) correctly follows the documented Vertex requirement.)*

- <a id="a8"></a>**A8 — New pipelines are written as JSON but saved back as YAML.**
  `createNewPipeline` writes `JSON.stringify(...)`
  ([extension.ts:70-89](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L70-L89)),
  whereas the webview persists `YAML.stringify(...)`
  ([App.tsx:336](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L336)).
  It happens to work (YAML ⊃ JSON) but means a file silently changes format on first edit, producing a
  confusing whole-file diff. **Fix:** emit YAML at creation.

---

## 3. Performance Bottlenecks

Consolidated; details in the linked items above.

- <a id="p1"></a>**P1** — O(n²) `parseOrRepairJson` blocking the extension host → **M10**
- <a id="p2"></a>**P2** — O(tokens × length) unmemoised `highlightCode` on every render → **M11**
- <a id="p3"></a>**P3** — React Flow re-render storm from unstable node identity → **M12**
- <a id="p4"></a>**P4** — Synchronous `fs.*` on autosave/codegen hot paths → **M18**
- <a id="p5"></a>**P5** — Eager `activationEvents: ["*"]` + unfiltered workspace-wide `findFiles('**/*.beam')` → **M17**
- <a id="p6"></a>**P6** — Full-document `YAML.stringify` of the entire graph every 1 s while editing
  ([App.tsx:327-346](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/App.tsx#L327-L346)),
  each triggering a synchronous whole-file rewrite on the host. Increase the debounce and/or dirty-check
  against the last serialised value before posting.
- <a id="p7"></a>**P7** — Unmemoised `.filter()` in render
  ([BottomPanel.tsx:74-76](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/BottomPanel/BottomPanel.tsx#L74-L76)); wrap in `useMemo`. *(Minor.)*

---

## 4. Actionable Remediation Plan

Ordered by risk-reduction per unit of effort.

**Phase 1 — Security & data loss (do before any further feature work)**
- **1.** Add the containment check to the codegen write loop; gate `chmod` to an allowlist. **(C1)**
- **2.** Rebuild cleanup as: reorder (delete *after* a validated payload) → `.beamgen.json` ownership
      marker + `pipelineId` → prompt-on-unowned-folder gate → allowlist deletion, with dependency
      folders (`.venv`/`target`/…) removed **only on language switch**. **(C3)**
- **3.** Move the 4 password fields to Secret Manager references; redact secrets from the prompt and stop
      writing the raw prompt to `gemini.log`; add `*.log` to the generated ignore files. **(C2, M15)**
- **4.** Remove the `cd "${folderPath}"` interpolation. **(M3)**
- **5.** Add a nonce-based CSP to the webview HTML. **(M2)**

**Phase 2 — Make the safety net real (unblocks everything after)**
- **6.** Add root `eslint.config.js` with `no-duplicate-case`; fix `npm test`; delete the empty test file;
      split unit vs. live-Gemini integration runs. **(M9)**
- **7.** Fix the `getSecrets` duplication **as one atomic commit**: delete the dead handler at line 1168,
      keep the correct one at 1274, **and** add the missing `.map(s => s.name)` normalisation in
      `sink/KinesisIO.tsx:131` — otherwise step 7 alone regresses the Kinesis sink to `[object Object]`.
      Audit the other 13 `secretsLoaded` listeners in the same pass. Add a regression test asserting
      short secret IDs reach the dropdown. **(M1 + M20 — do not split)**
- **8.** Regression tests for C1 (traversal payloads rejected) and M16 (multi-edge rewiring) — per the
      project's "every bug fix ships with a test" rule.

**Phase 3 — Correctness & lifecycle**
- **9.** Dispose webview listeners on panel dispose. **(M5)**
- **10.** Persist via `WorkspaceEdit`; add `onDidChangeTextDocument` to deliver the documented two-way sync. **(M4)**
- **11.** Fix the stale-closure folder refresh. **(M13)**
- **12.** Fix the `BigQueryIO` stale-closure that erases user input (source + sink). **(M19)**
- **13.** Fix multi-edge redirection. **(M16)**
- **14.** Switch `PropertyForm` to a metadata-driven registry. **(M14)**

**Phase 4 — Performance**
- **15.** Single-pass JSON repair. **(M10/P1)**
- **16.** Memoise + linearise `highlightCode`, and fix the `$`-pattern corruption. **(M11/P2)**
- **17.** Stabilise React Flow node references. **(M12/P3)**
- **18.** Narrow `activationEvents`; async `fs`. **(M17, M18)**

**Phase 5 — Structural (highest long-term ROI)**
- **19.** Extract `listAssets()`; collapse the 10 duplicated handlers and fix M6/M8 centrally. **(A2, M6, M7, M8)**
- **20.** Split `handleMessages` into a handler registry across `src/handlers/*`. **(A1)**
- **21.** Extract `CodeGenerator` + `LanguageStrategy`. **(A3)**
- **22.** Introduce `<PropertyField>`, `useExtensionMessage`, `useAssetLoader`, `<SecretManagerAuthFields>`
      and migrate the 41 property components. **(A4)**
- **23.** Decompose `App.tsx` into hooks. **(A6)**
- **24.** Untrack the 4 stale `.js`/`.map` files; reconcile the model constant; emit YAML at creation. **(A5, A7, A8)**
- **25.** Resolve the orphaned `ElementTransforms.test.tsx` and add the 3 missing test suites. **(M21)**

**Phase 6 — Live Model Evaluation & Prompt Engineering**
- **26.** Multi-agent evaluation harness (Beam Architecture, Security, Packaging, Lead Arbiter) with deterministic gates and automated prompt improvement suggestions for Python and Java. **(E1)**

**Phase 7 — Comprehensive Integration Pipeline Test Coverage**
- **27.** Relational & Broker Streaming: `jdbcio-to-jdbcio` (I1) and `kafkaio-to-kafkaio` (I2). **(✅ Done)**
- **28.** Cloud Analytics & Lakehouse Exports: `pubsub-to-bigquery` (I3) and `bigquery-to-parquet` (I4).
- **29.** Batch Tokenization & Synthetic Generation: `textio-wordcount` (I5) and `generatesequence-pubsub-fixed` (I6).
- **30.** AWS Ecosystem Pipelines: `kinesis-to-avro` (I7), `sqs-to-sns-filtered` (I8), and `sns-to-sqs-fanout` (I19).
- **31.** Enterprise Brokers & IoT: `mqtt-to-bigquery-sliding` (I9), `jms-to-jms-batching` (I10), and `mqtt-to-mqtt-retained` (I20).
- **32.** Dynamic Partitioning & Lakehouse Migration: `fileio-dynamic-destinations` (I11) and `avro-to-parquet-lakehouse` (I12).
- **33.** Advanced Beam Semantics: `periodic-impulse-to-jdbc` (I13), `create-aggregations-kv` (I14), and `pubsub-session-windows` (I15).
- **34.** Multi-PCollection Operations & Sampling: `multi-source-flatten-bigquery` (I16), `cogroupbykey-relational-join` (I17), and `distinct-statistical-sampling` (I18).


---

## 5. Model Evaluation & Prompt Quality Engineering

- <a id="e1"></a>**E1 — Multi-Agent End-to-End Live Model Evaluation Harness with Automated Prompt Improvement Feedback.**
  Replaces the single-prompt monolithic `evaluateGeneratedCode` with a multi-agent evaluation pipeline and deterministic pre-flight verification:
  1. **Deterministic Pre-flight Verification:**
     - Runs local syntax verification (e.g. `python3 -m py_compile` or AST parse) and basic structural syntax checks.
     - Deterministic credential & plaintext secret regex scanning across all generated files (`.beam`, `pom.xml`, `run_*.sh`, `Dockerfile`, code).
  2. **Three Specialized Parallel Evaluator Agents (`gemini-3.7-flash`):**
     - **`BeamArchitectureAgent`:** Evaluates pipeline DAG conformity against input YAML, streaming vs. batch semantics, windowing before aggregations on unbounded streams, main vs. tagged output handling (preventing silent element drops), timer selection (`PeriodicImpulse`), and dead-letter queue (DLQ) branch routing.
     - **`SecurityAndHardeningAgent`:** Evaluates Secret Manager integration (absence of plaintext passwords/tokens), container security (non-root execution, clean build context, no leak of logs or sensitive env vars), and path containment.
     - **`PackagingAndDeployabilityAgent`:** Evaluates build descriptor sanity (`pom.xml`, `requirements.txt`), dependency version compatibility (e.g. pinned Datafaker 2.7.0, Beam 2.50+), runner script flags (`run_directrunner.sh`, `run_dataflowrunner.sh`), and entrypoint alignment.
  3. **Lead Arbiter & Synthesizer Agent:**
     - Consolidates reports from all three sub-agents and deterministic gates.
     - Computes multi-dimensional rubric scores (Architecture, Security, Packaging, Maintainability) with hard vetoes on critical defects (syntax error, plaintext secrets, silent drops).
     - Outputs a structured scorecard with verdict (`passed: boolean`).
  4. **Automated Prompt Remediation Feedback:**
     - Because integration tests validate the **LLM Code Generator itself**, the evaluator does *not* patch generated code.
     - Instead, upon finding any defect, the Arbiter generates actionable **Prompt Remediation Directives** targeting `resources/code-gen-prompt-python.txt` and/or `resources/code-gen-prompt-java.txt`, specifying the exact prompt rule additions or corrections required so the generator will not repeat the mistake.
  5. **TypeScript Implementation & Testing:**
     - Implemented directly in TypeScript under `src/test/integration/evaluators/` and wired into `src/test/integration/codegen-runner.ts`.
     - Accompanied by unit tests for deterministic gates, sub-agent schema parsers, scoring calculations, and prompt recommendation synthesis.

---

## 6. Integration Test Pipeline Coverage (E2E Test Suites)

This task group systematically validates end-to-end code generation across **100% of the Apache Beam Designer's supported Sources (16), Sinks (14), and Step transforms (20)** using live Vertex AI (`gemini-3.7-flash`) and the Multi-Agent Evaluation Harness (`BeamArchitectureAgent`, `SecurityAndHardeningAgent`, `PackagingAndDeployabilityAgent`, and `LeadArbiter`).

Each test pipeline is maintained as a pair of artifacts:
- **Sidecar DAG YAML:** `src/test/integration/<pipeline-id>.yaml`
- **Vitest Integration Suite:** `src/test/integration/<pipeline-id>.test.ts`

- <a id="i1"></a>**I1 — `jdbcio-to-jdbcio` (Relational Database ETL)**
  - **DAG:** PostgreSQL `JdbcIO` Source ➔ `ParDo` Step (data transformation) ➔ MySQL `JdbcIO` Sink.
  - **Type:** Bounded Batch.
  - **Properties Tested:** PostgreSQL & MySQL drivers, parameterized connection strings, `fetchSize`, table reads, parameterized SQL `INSERT` statements with `autosharding`, Secret Manager credentials.
  - **Evaluation Focus:** Correct JDBC driver dependencies in `pom.xml`/`requirements.txt`, absence of plaintext credentials, proper database connection lifecycle.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Done (`7474752`).

- <a id="i2"></a>**I2 — `kafkaio-to-kafkaio` (Streaming Broker with DLQ)**
  - **DAG:** `KafkaIO` Source ➔ `ParDo` Step (JSON conversion with error routing) ➔ `KafkaIO` Sink (valid) + `LogMessage` Sink (error).
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** `bootstrapServers`, `topics`, `groupId`, `ByteArrayDeserializer`, `StringDeserializer`, `useEOS` (Exactly-Once Semantics), Dead-Letter Queue (DLQ) branch routing.
  - **Evaluation Focus:** Non-blocking streaming execution, proper handling of tagged output collections (`TupleTag` in Java / `pvalue.TaggedOutput` in Python) ensuring zero silent element drops.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Done (`7474752`).

- <a id="i3"></a>**I3 — `pubsub-to-bigquery` (Cloud Pub/Sub to BigQuery Storage Write API)**
  - **DAG:** `PubSubIO` Source ➔ `ParseMessage` (JSON) ➔ `ParDo` (schema validation with error branch) ➔ `BigQueryIO` Sink (valid) + `LogMessage` Sink (dead letter).
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** Pub/Sub subscription reading, timestamp attributes, BigQuery `STORAGE_WRITE_API`, `CREATE_IF_NEEDED`, `WRITE_APPEND`, dead-letter error routing.
  - **Evaluation Focus:** Correct BigQuery `TableSchema` generation, non-deprecated Storage Write API usage, proper Google Cloud IAM / ADC authentication, and tagged output DLQ.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Done.

- <a id="i4"></a>**I4 — `bigquery-to-parquet` (Data Warehouse Export to Columnar Lakehouse)**
  - **DAG:** `BigQueryIO` Source ➔ `Map` Step (schema projection) ➔ `ParquetIO` Sink.
  - **Type:** Bounded Batch.
  - **Properties Tested:** Standard SQL queries with export priority, columnar schema definition, Snappy compression codec, file sharding.
  - **Evaluation Focus:** High-throughput batch query execution, Parquet Avro-derived schema mapping, valid GCS / local file output directory configuration.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Done.

- <a id="i5"></a>**I5 — `textio-wordcount` (Canonical Batch Tokenization & Aggregation)**
  - **DAG:** `TextIO` Source (ReadLines) ➔ `FlatMap` (ExtractWords) ➔ `Count` (CountWords) ➔ `Map` (FormatAsText) ➔ `TextIO` Sink (WriteCounts).
  - **Type:** Bounded Batch.
  - **Properties Tested:** Delimited text reading (`filePattern`), 1-to-N element splitting (`Regex` pattern `[^\p{L}]+`), per-element combiners (`Count.perElement`), key-value text formatting (`Map`), output sharding and file naming patterns (`to`, `suffix`).
  - **Evaluation Focus:** Canonical Beam Quickstart pipeline idiom verification, correct PCollection type safety across element transforms, avoidance of unnecessary `GroupByKey` before `Count`.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Done.

- <a id="i6"></a>**I6 — `generatesequence-pubsub-fixed` (Synthetic Streaming & Fixed Windowing)**
  - **DAG:** `GenerateSequence` Source ➔ `WithTimestamps` ➔ `WindowInto` (Fixed Windows 60s) ➔ `KVMapper` ➔ `GroupByKey` ➔ `Sum` ➔ `PubSubIO` Sink.
  - **Type:** Unbounded Streaming (Synthetic).
  - **Properties Tested:** `from`, `to`, `rate` (elements/sec), explicit timestamp assignment, tumbling 60-second fixed event-time windows, unbounded `GroupByKey` with windowing, Pub/Sub topic publishing.
  - **Evaluation Focus:** Architectural verification that unbounded streams MUST have explicit windowing applied before any `GroupByKey`/`Combine` operation to prevent runtime grouping exceptions.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Done.

- <a id="i7"></a>**I7 — `kinesis-to-avro` (AWS Kinesis Streaming to Avro Storage)**
  - **DAG:** `KinesisIO` Source ➔ `ParseMessage` (JSON) ➔ `AvroIO` Sink.
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** `streamName`, `TRIM_HORIZON`, AWS region, AWS credentials via Secret Manager, Avro schema serialization, windowed file writing (`withWindowedWrites`).
  - **Evaluation Focus:** Streaming file sink windowing compatibility in Beam, AWS SDK dependency configuration, Secret Manager credential resolution without hardcoded AWS secrets.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i8"></a>**I8 — `sqs-to-sns-filtered` (AWS SQS Queue to SNS Topic Pub/Sub)**
  - **DAG:** `SqsIO` Source ➔ `Filter` (priority messages) ➔ `ParDo` (enrichment) ➔ `SnsIO` Sink.
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** SQS queue URL, `maxNumRecords`, AWS region, boolean predicate expression, SNS topic ARN, message attributes.
  - **Evaluation Focus:** Correct AWS SQS/SNS connector usage, graceful handling of poison messages, avoidance of credential leakage in logs or prompt.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i9"></a>**I9 — `mqtt-to-bigquery-sliding` (IoT Telemetry with Sliding Windows)**
  - **DAG:** `MqttIO` Source ➔ `ParseMessage` (JSON) ➔ `WindowInto` (Sliding Windows: duration 5m, period 1m) ➔ `Mean` per sensor ➔ `BigQueryIO` Sink.
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** MQTT connection URI, topics, QoS, TLS options, hopping/sliding event-time windows, sliding window aggregations, BigQuery streaming inserts.
  - **Evaluation Focus:** Multi-window membership semantics, watermark progression on IoT streams, correct double arithmetic combiner for Mean.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i10"></a>**I10 — `jms-to-jms-batching` (Enterprise Message Broker with Batch Bundling)**
  - **DAG:** `JmsIO` Source ➔ `GroupIntoBatches` (batchSize: 100) ➔ `ParDo` (bulk payload processor) ➔ `JmsIO` Sink.
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** ActiveMQ / Artemis connection factory, queue vs topic destination, batch bundling by count and duration, transactional acknowledgment.
  - **Evaluation Focus:** Proper stateful DoFn or Beam `GroupIntoBatches` transform usage, JMS resource connection lifecycle management in setup/teardown.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i11"></a>**I11 — `fileio-dynamic-destinations` (Dynamic File Partitioning & Custom Naming)**
  - **DAG:** `FileIO` Source (match & read) ➔ `ParDo` (extract partition key like date/region) ➔ `FileIO` Sink (dynamic destinations).
  - **Type:** Bounded Batch.
  - **Properties Tested:** File pattern wildcard matching (`*.csv`), file streams, `DynamicDestinations` partition strategy, custom naming format, Cloud Storage / local destinations.
  - **Evaluation Focus:** Correct `FileIO.writeDynamic()` implementation in Java and dynamic sink partitioning in Python, prevent filesystem path traversal.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i12"></a>**I12 — `avro-to-parquet-lakehouse` (Binary Format Migration & Compression)**
  - **DAG:** `AvroIO` Source ➔ `Map` Step (type & column mapping) ➔ `ParquetIO` Sink.
  - **Type:** Bounded Batch.
  - **Properties Tested:** Avro schema parsing, Record-to-GenericRecord projection, Parquet schema generation, Snappy and Gzip compression codecs.
  - **Evaluation Focus:** High-performance columnar serialization, correct Hadoop / Parquet dependency coordination in `pom.xml`, zero data loss across binary formats.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i13"></a>**I13 — `periodic-impulse-to-jdbc` (Periodic Trigger ETL with Parameterized SQL)**
  - **DAG:** `PeriodicImpulse` Source ➔ `ParDo` (fetch external API/metrics) ➔ `JdbcIO` Sink.
  - **Type:** Unbounded Periodic.
  - **Properties Tested:** `startTimestamp`, `stopTimestamp`, `fireInterval` (e.g. 5 minutes), DoFn HTTP request execution, JDBC batch insert statement with MySQL, autosharding.
  - **Evaluation Focus:** Proper continuous execution using `PeriodicImpulse`, idempotent database writes, robust error handling around external network calls.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i14"></a>**I14 — `create-aggregations-kv` (In-Memory Dataset with Statistical Analytics)**
  - **DAG:** `Create` Source ➔ `KVMapper` ➔ `Top` (Top-N) + `ApproximateQuantiles` + `Min` + `Max` ➔ `Keys` + `Values` + `KvSwap` ➔ `LogMessage` Sink.
  - **Type:** Bounded Batch.
  - **Properties Tested:** Static in-memory collection creation, composite key-value mappings, multi-branch statistical transforms, comparator functions, KV component extraction and inversion.
  - **Evaluation Focus:** Pure Beam SDK functional transforms, fan-out branching from a single PCollection to multiple aggregations, correct comparator serialization.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i15"></a>**I15 — `pubsub-session-windows` (User Activity Session Windowing & Early Triggers)**
  - **DAG:** `PubSubIO` Source ➔ `WithTimestamps` ➔ `KVMapper` (keyed by `userId`) ➔ `WindowInto` (Session Windows: 10m gap duration, early trigger every 1m, allowed lateness 5m) ➔ `Count` per session ➔ `BigQueryIO` Sink.
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** Keyed session windows, gap duration specification, complex triggers (`AfterWatermark.withEarlyFirings()`), `AccumulationMode.ACCUMULATING_FIRED_PANES`, allowed lateness.
  - **Evaluation Focus:** Complex windowing semantics, verifying that session windows are correctly keyed (sessions are calculated per key, not globally), correct trigger firing handling.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i16"></a>**I16 — `multi-source-flatten-bigquery` (Multi-Stream Ingestion, Merge, and Reshuffle)**
  - **DAG:** `PubSubIO` Source + `KafkaIO` Source ➔ `ParseMessage` (standardize to common schema) ➔ `Flatten` ➔ `Reshuffle` ➔ `BigQueryIO` Sink.
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** Multi-source ingestion, schema normalization, `Flatten.pCollections()` merging multiple input streams into a single PCollection, `Reshuffle` to balance worker partitions and break fusion.
  - **Evaluation Focus:** Type consistency across merged PCollections, proper fusion-breaking semantics, streaming BigQuery write disposition.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i17"></a>**I17 — `cogroupbykey-relational-join` (Multi-Collection Relational Join)**
  - **DAG:** `Create` Source A (Orders) + `Create` Source B (Customers) ➔ `KVMapper` (keyed by `customerId`) ➔ `CoGroupByKey` ➔ `ParDo` (relational inner/left join) ➔ `TextIO` Sink.
  - **Type:** Bounded Batch.
  - **Properties Tested:** Multi-collection joining, common join key extraction, `CoGbkResult` iteration, handling missing / null customer records.
  - **Evaluation Focus:** Proper `CoGroupByKey` idiom usage in Beam, handling multi-collection type tags, memory-safe iteration over joined iterables.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i18"></a>**I18 — `distinct-statistical-sampling` (Deduplication, Sampling, and HyperLogLog Estimation)**
  - **DAG:** `TextIO` Source ➔ `Distinct` ➔ `Sample` (uniform random sample) ➔ `ApproximateUnique` ➔ `LogMessage` Sink.
  - **Type:** Bounded Batch.
  - **Properties Tested:** Full-record deduplication, random subset sampling (`Sample.any(N)`), HyperLogLog cardinality estimation, structured logging.
  - **Evaluation Focus:** Proper statistical transform usage, memory efficiency on large input collections, verify no unnecessary sorting or grouping.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i19"></a>**I19 — `sns-to-sqs-fanout` (AWS Notification Fanout to Distributed Queues)**
  - **DAG:** `SnsIO` Source ➔ `ParDo` (message unpacker & attribute filter) ➔ `SqsIO` Sink.
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** AWS SNS subscription, message payload extraction, message deduplication IDs, SQS batch publishing.
  - **Evaluation Focus:** AWS SDK v2 integration, non-blocking queue publishing, clean container packaging with AWS credentials.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

- <a id="i20"></a>**I20 — `mqtt-to-mqtt-retained` (IoT Broker Routing with QoS 1, Retain, and DLQ)**
  - **DAG:** `MqttIO` Source ➔ `ParDo` (sensor threshold alert detection with error branch) ➔ `MqttIO` Sink (alert topic, QoS 1, retain: true) + `LogMessage` Sink (dead letter).
  - **Type:** Unbounded Streaming.
  - **Properties Tested:** MQTT connection URI, clientId, QoS levels, retain flag on published messages, error branching with side outputs.
  - **Evaluation Focus:** IoT protocol options support, clean MQTT client connection management, proper error handling and dead-letter queueing.
  - **Target Languages:** Java, Python.
  - **Status:** ✅ Completed (Definition & Multi-Agent Test Suite Wired).

---

## 7. Apache Beam IO Connector Expansion Tasks

This section defines individual engineering tasks for every supported Apache Beam I/O connector listed in the [official Apache Beam documentation](https://beam.apache.org/documentation/io/connectors/).

### Architecture & Implementation Standards for Each Connector Task:

1. **Pre-Implementation Form Plan & Docs Review:**
   - Before implementing, thoroughly review the official Java and Python documentation links to find all possible properties and their valid value(s). Strictly no guessing of valid properties.
   - Formulate a clean property schema and layout plan for both the Source (reader) panel and the Sink (writer) panel before generating the panel, mapping out required vs. optional connection parameters, serialization, batch/streaming configurations, and windowing/sharding rules.

2. **Strict Scope Isolation (Do Not Modify Other Nodes):**
   - **CRITICAL:** Do NOT modify existing nodes, step transforms, or property panels in the project. Each task is strictly scoped to adding **only 2 new nodes** (1 Source reader and 1 Sink writer) and their accompanying property panels, tests, and registration.

3. **Form Usability & Dynamic Cloud Value Discovery (`gcloud` / CLI Callbacks):**
   - Focus heavily on the **usability of the property form**: avoid forcing users to manually type complex cloud resource names, ARNs, bucket paths, or plaintext passwords.
   - For any value that can be retrieved via `gcloud` (or `aws` CLI), add a callback from the webview to the extension host (`vscode.postMessage({ command: '<commandName>' })`).
   - Wire the returned assets to HTML `<datalist>` or `<select>` autocomplete elements with graceful manual text entry fallback.
   - If the extension host does not yet handle the message in `src/extension.ts`, implement the command in `MESSAGE_HANDLERS` using the centralized, unit-tested `listAssets()` runner.

4. **Python Cross-Language (`x-lang`) Strategy:**
   - For connectors where Python does not have a native Beam SDK implementation, explicitly configure the transform as **Cross-Language (`x-lang`)** calling the Java expansion service (`apache_beam.transforms.xlang` or Beam SchemaTransforms).
   - In the property panel, include expansion service configuration options (e.g., auto-start Java expansion service or connect to an existing expansion service endpoint).

5. **1 Source (Reader) Node:**
   - **Palette Registration:** Add node to `SOURCE_NODES` in [`NodesCard.tsx`](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/NodesCard.tsx) under the specified category (`Streaming Sources`, `Database Sources`, `File Sources`, `Healthcare Sources`, or `Data Services Sources`).
   - **Property Panel Component:** Create `webview/src/properties/source/<Connector>.tsx` with dedicated form controls for all connector-specific parameters.
   - **Dispatcher Mapping:** Register `'SOURCE:<Transform>'` in `PROPERTY_FORM_REGISTRY` in [`PropertyForm.tsx`](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/PropertyForm.tsx).
   - **Unit Test Coverage:** Create comprehensive unit tests in `webview/src/properties/source/<Connector>.test.tsx` achieving 100% branch and rendering coverage.

6. **1 Sink (Writer) Node:**
   - **Palette Registration:** Add node to `SINK_NODES` in [`NodesCard.tsx`](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/NodesCard.tsx) under the specified category (`Streaming Sinks`, `Database Sinks`, `File Sinks`, `Logging Sinks`, or `Data Services Sinks`).
   - **Property Panel Component:** Create `webview/src/properties/sink/<Connector>.tsx` with dedicated form controls for writing/publishing parameters.
   - **Dispatcher Mapping:** Register `'SINK:<Transform>'` in `PROPERTY_FORM_REGISTRY` in [`PropertyForm.tsx`](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/PropertyForm.tsx).
   - **Unit Test Coverage:** Create comprehensive unit tests in `webview/src/properties/sink/<Connector>.test.tsx` achieving 100% branch and rendering coverage.

7. **UI/UX Layout & Styling Standards:**
   - **8pt Grid System:** All paddings, margins, element dimensions, and gutters strictly conform to multiples of 8px (`p-2`, `p-4`, `space-y-4`, `gap-2`).
   - **VS Code Theme Tokens:** Rely exclusively on VS Code theme variables (`var(--vscode-editor-background)`, `var(--vscode-input-background)`, `var(--vscode-focusBorder)`, etc.) with Tailwind CSS classes.
   - **Header & Documentation Links:** Every panel features a top header with transform icon, badges (`Source`/`Sink`, category, format/protocol), and direct clickable links to the official Java SDK and Python SDK documentation.
   - **Field Grouping:** Organize fields logically: Connection & Authentication, Target / Topic / Path / Table, Data Format & Serialization, Performance / Sharding / Windowing, and Code Generation Prompt Overrides (`system_instructions`).
   - **State Flow:** Pure event-driven component pattern: accept `node` data as props and emit changes upward via `onChange(newProperties)`.

8. **End-to-End Integration Test Suite:**
   - For each connector, generate at least one new integration test consisting of a sidecar DAG pipeline (`src/test/integration/<connector-name>.beam`) and a Vitest integration test suite (`src/test/integration/<connector-name>.test.ts`).
   - The integration test must validate end-to-end code generation for the connector (exercising Source and/or Sink in a realistic pipeline DAG) across target SDK languages, passing the Multi-Agent Evaluation Harness (`BeamArchitectureAgent`, `SecurityAndHardeningAgent`, `PackagingAndDeployabilityAgent`, and `LeadArbiter`).

---

### 7.1 Built-in I/O Connectors (IO1 – IO67)

- <a id="io1"></a>**IO1 — `FileIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [FileIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html)
    - **Python SDK:** [FileIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.fileio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `FileIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `FileIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'FileIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/FileIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:FileIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/FileIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `FileIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'FileIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/FileIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:FileIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/FileIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/fileio-dynamic-destinations.test.ts` (`fileio-dynamic-destinations.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io2"></a>**IO2 — `AvroIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [AvroIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/extensions/avro/io/AvroIO.html)
    - **Python SDK:** [AvroIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.avroio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `AvroIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `AvroIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'AvroIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/AvroIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:AvroIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/AvroIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `AvroIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'AvroIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/AvroIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:AvroIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/AvroIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/avro-to-parquet-lakehouse.test.ts` (`avro-to-parquet-lakehouse.beam`) and `src/test/integration/kinesis-to-avro.test.ts` (`kinesis-to-avro.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io3"></a>**IO3 — `TextIO (metrics)`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [TextIO (metrics) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TextIO.html)
    - **Python SDK:** [TextIO (metrics) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.textio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `TextIO (metrics)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `TextIO (metrics)` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'TextIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/TextIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:TextIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/TextIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `TextIO (metrics)` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'TextIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/TextIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:TextIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/TextIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/textio-wordcount.test.ts` (`textio-wordcount.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io4"></a>**IO4 — `TFRecordIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [TFRecordIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TFRecordIO.html)
    - **Python SDK:** [TFRecordIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.tfrecordio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `TFRecordIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `TFRecordIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'TFRecordIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/TFRecordIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:TFRecordIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/TFRecordIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `TFRecordIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'TFRecordIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/TFRecordIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:TFRecordIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/TFRecordIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/tfrecordio-pipeline.beam` and `src/test/integration/tfrecordio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io5"></a>**IO5 — `XmlIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [XmlIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/xml/XmlIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `XmlIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `XmlIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'XmlIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/XmlIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:XmlIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/XmlIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `XmlIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'XmlIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/XmlIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:XmlIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/XmlIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/xmlio-pipeline.beam` and `src/test/integration/xmlio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io6"></a>**IO6 — `TikaIO`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [TikaIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/tika/TikaIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `TikaIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `TikaIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'TikaIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/TikaIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:TikaIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/TikaIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `TikaIO` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'TikaIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/TikaIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:TikaIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/TikaIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/tikaio-pipeline.beam` and `src/test/integration/tikaio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io7"></a>**IO7 — `ParquetIO (guide)`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [ParquetIO (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/parquet/ParquetIO.html)
    - **Python SDK:** [ParquetIO (guide) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.parquetio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `ParquetIO (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `ParquetIO (guide)` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'ParquetIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/ParquetIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:ParquetIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/ParquetIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `ParquetIO (guide)` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'ParquetIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/ParquetIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:ParquetIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/ParquetIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/bigquery-to-parquet.test.ts` (`bigquery-to-parquet.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io8"></a>**IO8 — `ThriftIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [ThriftIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/thrift/ThriftIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `ThriftIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `ThriftIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'ThriftIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/ThriftIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:ThriftIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/ThriftIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `ThriftIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'ThriftIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/ThriftIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:ThriftIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/ThriftIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/thriftio-pipeline.beam` and `src/test/integration/thriftio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io9"></a>**IO9 — `HadoopFileSystem`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [HadoopFileSystem JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/hdfs/HadoopFileSystemRegistrar.html)
    - **Python SDK:** [HadoopFileSystem PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.hadoopfilesystem.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `HadoopFileSystem`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `HadoopFileSystem` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'HadoopFileSystem', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/HadoopFileSystem.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:HadoopFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/HadoopFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `HadoopFileSystem` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'HadoopFileSystem', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/HadoopFileSystem.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:HadoopFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/HadoopFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/hadoopfilesystem-pipeline.beam` and `src/test/integration/hadoopfilesystem-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io10"></a>**IO10 — `GcsFileSystem (metrics)`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [GcsFileSystem (metrics) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/extensions/gcp/storage/GcsFileSystemRegistrar.html)
    - **Python SDK:** [GcsFileSystem (metrics) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.gcp.gcsfilesystem.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `GcsFileSystem (metrics)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `GcsFileSystem (metrics)` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'GcsFileSystem', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/GcsFileSystem.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:GcsFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/GcsFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `GcsFileSystem (metrics)` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'GcsFileSystem', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/GcsFileSystem.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:GcsFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/GcsFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/gcsfilesystem-pipeline.beam` and `src/test/integration/gcsfilesystem-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io11"></a>**IO11 — `LocalFileSystem`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [LocalFileSystem JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/LocalFileSystemRegistrar.html)
    - **Python SDK:** [LocalFileSystem PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.localfilesystem.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `LocalFileSystem`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `LocalFileSystem` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'LocalFileSystem', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/LocalFileSystem.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:LocalFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/LocalFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `LocalFileSystem` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'LocalFileSystem', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/LocalFileSystem.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:LocalFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/LocalFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/localfilesystem-pipeline.beam` and `src/test/integration/localfilesystem-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io12"></a>**IO12 — `S3FileSystem`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [S3FileSystem JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/s3/S3FileSystemRegistrar.html)
    - **Python SDK:** [S3FileSystem PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.aws.s3filesystem.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `S3FileSystem`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `S3FileSystem` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'S3FileSystem', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/S3FileSystem.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:S3FileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/S3FileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `S3FileSystem` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'S3FileSystem', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/S3FileSystem.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:S3FileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/S3FileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/s3filesystem-pipeline.beam` and `src/test/integration/s3filesystem-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io13"></a>**IO13 — `In-memory`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** Not available natively in Java SDK (✘)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `In-memory`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `In-memory` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'CreateIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CreateIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:CreateIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CreateIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `In-memory` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'CreateIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CreateIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:CreateIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CreateIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/create-aggregations-kv.test.ts` (`create-aggregations-kv.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io14"></a>**IO14 — `KinesisIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [KinesisIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/kinesis/KinesisIO.html)
    - **Python SDK:** [KinesisIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.kinesis.html#apache_beam.io.kinesis.ReadDataFromKinesis)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getAwsQueues` / `getAwsTopics` / `getAwsStreams` (`aws sqs/sns/kinesis list`); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `KinesisIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `KinesisIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'KinesisIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/KinesisIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:KinesisIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/KinesisIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `KinesisIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'KinesisIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/KinesisIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:KinesisIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/KinesisIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/kinesis-to-avro.test.ts` (`kinesis-to-avro.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io15"></a>**IO15 — `AmqpIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [AmqpIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/amqp/AmqpIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `AmqpIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `AmqpIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'AmqpIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/AmqpIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:AmqpIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/AmqpIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `AmqpIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'AmqpIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/AmqpIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:AmqpIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/AmqpIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/amqp-source.{beam,test.ts}` following `AmqpIO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/amqp-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> AmqpIO`).
  - **Status:** ✅ Completed (Source + Sink panels, 40 unit tests, fixture + integration spec). Uses the shared `ExpansionServiceFields` primitive for the Python x-lang group. NOTE: `handleApplyProtocol` rewrites each address line independently (port-boundary swap 5672↔5671) because the newline-separated multi-address list was previously corrupted by a single non-multiline regex; `handleSelectInstanceIp` is append-only to avoid destroying an existing address list.

- <a id="io16"></a>**IO16 — `KafkaIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [KafkaIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/kafka/KafkaIO.html)
    - **Python SDK:** [KafkaIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.kafka.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getComputeInstances` (`gcloud compute instances list` for broker host VMs); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `KafkaIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `KafkaIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'KafkaIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/KafkaIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:KafkaIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/KafkaIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `KafkaIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'KafkaIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/KafkaIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:KafkaIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/KafkaIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/kafkaio-to-kafkaio.test.ts` (`kafkaio-to-kafkaio.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io17"></a>**IO17 — `PubSubIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [PubSubIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/pubsub/PubsubIO.html)
    - **Python SDK:** [PubSubIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.gcp.pubsub.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getTopics` / `getSubscriptions` (`gcloud pubsub topics/subscriptions list`).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `PubSubIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `PubSubIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'PubSubIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/PubSubIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:PubSubIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/PubSubIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `PubSubIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'PubSubIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/PubSubIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:PubSubIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/PubSubIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/pubsub-to-bigquery.test.ts` (`pubsub-to-bigquery.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io18"></a>**IO18 — `JmsIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [JmsIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jms/JmsIO.html)
    - **Python SDK:** [JmsIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.transforms.xlang.io.html#apache_beam.transforms.xlang.io.ReadFromJms)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getComputeInstances` (`gcloud compute instances list` for broker host VMs); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `JmsIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `JmsIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'JmsIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/JmsIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:JmsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/JmsIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `JmsIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'JmsIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/JmsIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:JmsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/JmsIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/jms-to-jms-batching.test.ts` (`jms-to-jms-batching.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io19"></a>**IO19 — `MqttIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [MqttIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mqtt/MqttIO.html)
    - **Python SDK:** [MqttIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.transforms.xlang.io.html#apache_beam.transforms.xlang.io.ReadFromMqtt)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getComputeInstances` (`gcloud compute instances list` for broker host VMs); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `MqttIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `MqttIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'MqttIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/MqttIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:MqttIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/MqttIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `MqttIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'MqttIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/MqttIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:MqttIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/MqttIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/mqtt-to-bigquery-sliding.test.ts` (`mqtt-to-bigquery-sliding.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io20"></a>**IO20 — `RabbitMqIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [RabbitMqIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/rabbitmq/RabbitMqIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getComputeInstances` (`gcloud compute instances list` for broker host VMs); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `RabbitMqIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `RabbitMqIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'RabbitMqIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/RabbitMqIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:RabbitMqIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/RabbitMqIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `RabbitMqIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'RabbitMqIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/RabbitMqIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:RabbitMqIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/RabbitMqIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/rabbitmq-source.{beam,test.ts}` following `RabbitMqIO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/rabbitmq-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> RabbitMqIO`).
  - **Status:** ✅ Completed (Source + Sink panels, 51 unit tests, fixture + integration spec). NOTE: RabbitMQ's URI embeds credentials, so the panel deliberately splits host/port/vhost/username fields from a Secret Manager password reference — the generated code assembles the URI from the secret at runtime and the password is never persisted in the `.beam` file. Panels were decomposed into `components/common/rabbitmq/RabbitMqConnectionFields.tsx` and `RabbitMqDestinationFields.tsx` to stay within repo file-size norms.

- <a id="io21"></a>**IO21 — `SqsIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SqsIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sqs/SqsIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getAwsQueues` / `getAwsTopics` / `getAwsStreams` (`aws sqs/sns/kinesis list`); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SqsIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SqsIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'SqsIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SqsIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SqsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SqsIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SqsIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'SqsIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SqsIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SqsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SqsIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/sqs-to-sns-filtered.test.ts` (`sqs-to-sns-filtered.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io22"></a>**IO22 — `SnsIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SnsIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sns/SnsIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getAwsQueues` / `getAwsTopics` / `getAwsStreams` (`aws sqs/sns/kinesis list`); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SnsIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SnsIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'SnsIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SnsIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SnsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SnsIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SnsIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'SnsIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SnsIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SnsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SnsIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/sns-to-sqs-fanout.test.ts` (`sns-to-sqs-fanout.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io23"></a>**IO23 — `CassandraIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [CassandraIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/cassandra/CassandraIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `CassandraIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `CassandraIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'CassandraIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CassandraIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:CassandraIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CassandraIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `CassandraIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'CassandraIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CassandraIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:CassandraIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CassandraIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/cassandraio-pipeline.beam` and `src/test/integration/cassandraio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io24"></a>**IO24 — `HadoopFormatIO (guide)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [HadoopFormatIO (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/hadoop/format/HadoopFormatIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `HadoopFormatIO (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `HadoopFormatIO (guide)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'HadoopFormatIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/HadoopFormatIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:HadoopFormatIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/HadoopFormatIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `HadoopFormatIO (guide)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'HadoopFormatIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/HadoopFormatIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:HadoopFormatIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/HadoopFormatIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/hadoopformatio-pipeline.beam` and `src/test/integration/hadoopformatio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io25"></a>**IO25 — `HBaseIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [HBaseIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/hbase/HBaseIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `HBaseIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `HBaseIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'HBaseIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/HBaseIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:HBaseIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/HBaseIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `HBaseIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'HBaseIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/HBaseIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:HBaseIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/HBaseIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/hbaseio-pipeline.beam` and `src/test/integration/hbaseio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io26"></a>**IO26 — `HCatalogIO (guide)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [HCatalogIO (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/hcatalog/HCatalogIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `HCatalogIO (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `HCatalogIO (guide)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'HCatalogIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/HCatalogIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:HCatalogIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/HCatalogIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `HCatalogIO (guide)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'HCatalogIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/HCatalogIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:HCatalogIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/HCatalogIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/hcatalogio-pipeline.beam` and `src/test/integration/hcatalogio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io27"></a>**IO27 — `KuduIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [KuduIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/kudu/KuduIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `KuduIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `KuduIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'KuduIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/KuduIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:KuduIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/KuduIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `KuduIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'KuduIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/KuduIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:KuduIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/KuduIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/kuduio-pipeline.beam` and `src/test/integration/kuduio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io28"></a>**IO28 — `SolrIO`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SolrIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/solr/SolrIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SolrIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SolrIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'SolrIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SolrIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SolrIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SolrIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SolrIO` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'SolrIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SolrIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SolrIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SolrIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/solrio-pipeline.beam` and `src/test/integration/solrio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io29"></a>**IO29 — `ElasticsearchIO`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [ElasticsearchIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/elasticsearch/ElasticsearchIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `ElasticsearchIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `ElasticsearchIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'ElasticsearchIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/ElasticsearchIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:ElasticsearchIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/ElasticsearchIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `ElasticsearchIO` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'ElasticsearchIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/ElasticsearchIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:ElasticsearchIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/ElasticsearchIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/elasticsearchio-pipeline.beam` and `src/test/integration/elasticsearchio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io30"></a>**IO30 — `BigQueryIO (guide) (metrics)`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [BigQueryIO (guide) (metrics) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/bigquery/BigQueryIO.html)
    - **Python SDK:** [BigQueryIO (guide) (metrics) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.gcp.bigquery.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getDatasets` / `getTables` (`bq ls / gcloud bigquery`).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `BigQueryIO (guide) (metrics)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `BigQueryIO (guide) (metrics)` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'BigQueryIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/BigQueryIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:BigQueryIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/BigQueryIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `BigQueryIO (guide) (metrics)` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'BigQueryIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/BigQueryIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:BigQueryIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/BigQueryIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/pubsub-to-bigquery.test.ts` (`pubsub-to-bigquery.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io31"></a>**IO31 — `BigTableIO (metrics)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [BigTableIO (metrics) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/bigtable/BigtableIO.html)
    - **Python SDK:** [BigTableIO (metrics) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.gcp.bigtableio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getBigtableInstances` (`gcloud bigtable instances list`).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `BigTableIO (metrics)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `BigTableIO (metrics)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'BigTableIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/BigTableIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:BigTableIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/BigTableIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `BigTableIO (metrics)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'BigTableIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/BigTableIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:BigTableIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/BigTableIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/bigtableio-pipeline.beam` and `src/test/integration/bigtableio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io32"></a>**IO32 — `DatastoreIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [DatastoreIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/datastore/DatastoreIO.html)
    - **Python SDK:** [DatastoreIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.gcp.datastore.v1new.datastoreio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getFirestoreDatabases` (`gcloud firestore databases list`).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `DatastoreIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `DatastoreIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'DatastoreIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/DatastoreIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:DatastoreIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/DatastoreIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `DatastoreIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'DatastoreIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/DatastoreIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:DatastoreIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/DatastoreIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/datastoreio-pipeline.beam` and `src/test/integration/datastoreio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io33"></a>**IO33 — `SnowflakeIO (guide)`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SnowflakeIO (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/snowflake/SnowflakeIO.html)
    - **Python SDK:** [SnowflakeIO (guide) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.snowflake.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SnowflakeIO (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SnowflakeIO (guide)` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'SnowflakeIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SnowflakeIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SnowflakeIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SnowflakeIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SnowflakeIO (guide)` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'SnowflakeIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SnowflakeIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SnowflakeIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SnowflakeIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/snowflakeio-pipeline.beam` and `src/test/integration/snowflakeio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io34"></a>**IO34 — `SpannerIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SpannerIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/spanner/SpannerIO.html)
    - **Python SDK:** [SpannerIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.gcp.spanner.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSpannerInstances` / `getSpannerDatabases` (`gcloud spanner instances/databases list`).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SpannerIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SpannerIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'SpannerIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SpannerIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SpannerIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SpannerIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SpannerIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'SpannerIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SpannerIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SpannerIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SpannerIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/spannerio-pipeline.beam` and `src/test/integration/spannerio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io35"></a>**IO35 — `JdbcIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [JdbcIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jdbc/JdbcIO.html)
    - **Python SDK:** [JdbcIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.jdbc.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `JdbcIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `JdbcIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'JdbcIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/JdbcIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:JdbcIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/JdbcIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `JdbcIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'JdbcIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/JdbcIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:JdbcIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/JdbcIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/jdbcio-to-jdbcio.test.ts` (`jdbcio-to-jdbcio.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io36"></a>**IO36 — `DebeziumIO`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [DebeziumIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/io/debezium/DebeziumIO.html)
    - **Python SDK:** [DebeziumIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.debezium.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `DebeziumIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `DebeziumIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'DebeziumIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/DebeziumIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:DebeziumIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/DebeziumIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `DebeziumIO` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'DebeziumIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/DebeziumIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:DebeziumIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/DebeziumIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/debeziumio-pipeline.beam` and `src/test/integration/debeziumio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io37"></a>**IO37 — `MongoDbIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [MongoDbIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mongodb/MongoDbIO.html)
    - **Python SDK:** [MongoDbIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.mongodbio.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `MongoDbIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `MongoDbIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'MongoDbIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/MongoDbIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:MongoDbIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/MongoDbIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `MongoDbIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'MongoDbIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/MongoDbIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:MongoDbIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/MongoDbIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/mongodbio-pipeline.beam` and `src/test/integration/mongodbio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io38"></a>**IO38 — `MongoDbGridFSIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [MongoDbGridFSIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mongodb/MongoDbGridFSIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `MongoDbGridFSIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `MongoDbGridFSIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'MongoDbGridFSIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/MongoDbGridFSIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:MongoDbGridFSIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/MongoDbGridFSIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `MongoDbGridFSIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'MongoDbGridFSIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/MongoDbGridFSIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:MongoDbGridFSIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/MongoDbGridFSIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/mongodbgridfsio-pipeline.beam` and `src/test/integration/mongodbgridfsio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io39"></a>**IO39 — `RedisIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [RedisIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/redis/RedisIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `RedisIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `RedisIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'RedisIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/RedisIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:RedisIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/RedisIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `RedisIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'RedisIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/RedisIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:RedisIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/RedisIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/redisio-pipeline.beam` and `src/test/integration/redisio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io40"></a>**IO40 — `DynamoDBIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [DynamoDBIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/dynamodb/DynamoDBIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getAwsQueues` / `getAwsTopics` / `getAwsStreams` (`aws sqs/sns/kinesis list`); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `DynamoDBIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `DynamoDBIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'DynamoDBIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/DynamoDBIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:DynamoDBIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/DynamoDBIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `DynamoDBIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'DynamoDBIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/DynamoDBIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:DynamoDBIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/DynamoDBIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/dynamodbio-pipeline.beam` and `src/test/integration/dynamodbio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io41"></a>**IO41 — `ClickHouseIO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [ClickHouseIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/clickhouse/ClickHouseIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `ClickHouseIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `ClickHouseIO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'ClickHouseIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/ClickHouseIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:ClickHouseIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/ClickHouseIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `ClickHouseIO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'ClickHouseIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/ClickHouseIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:ClickHouseIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/ClickHouseIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/clickhouseio-pipeline.beam` and `src/test/integration/clickhouseio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io42"></a>**IO42 — `ArrowFlightIO`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [ArrowFlightIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/arrowflight/ArrowFlightIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `ArrowFlightIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `ArrowFlightIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'ArrowFlightIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/ArrowFlightIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:ArrowFlightIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/ArrowFlightIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `ArrowFlightIO` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'ArrowFlightIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/ArrowFlightIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:ArrowFlightIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/ArrowFlightIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/arrowflightio-pipeline.beam` and `src/test/integration/arrowflightio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io43"></a>**IO43 — `DatabaseIO`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** Not available natively in Java SDK (✘)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `DatabaseIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `DatabaseIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'DatabaseIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/DatabaseIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:DatabaseIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/DatabaseIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `DatabaseIO` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'DatabaseIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/DatabaseIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:DatabaseIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/DatabaseIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/databaseio-pipeline.beam` and `src/test/integration/databaseio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io44"></a>**IO44 — `GenerateSequence`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [GenerateSequence JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/GenerateSequence.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `GenerateSequence`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `GenerateSequence` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'GenerateSequence', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/GenerateSequence.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:GenerateSequence'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/GenerateSequence.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `GenerateSequence` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'GenerateSequence', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/GenerateSequence.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:GenerateSequence'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/GenerateSequence.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Validated in end-to-end integration test suite `src/test/integration/generatesequence-pubsub-fixed.test.ts` (`generatesequence-pubsub-fixed.beam`).
  - **Status:** ✅ Done (Already implemented).

- <a id="io45"></a>**IO45 — `SplunkIO`**
  - **Category Alignment:** `Logging Sinks` (Sink ONLY).
  - **Documentation Links:**
    - **Java SDK:** [SplunkIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/splunk/SplunkIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Native Direction Audit Note:** `SOURCE:SplunkIO` was intentionally skipped because `org.apache.beam.sdk.io.splunk.SplunkIO` only provides a native `Write` sink (`SplunkIO.write` / `SplunkIO.Write` for Splunk HTTP Event Collector [HEC]) and has no native `Read` transform in Apache Beam.
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - [x] `getSecrets` (`gcloud secrets list` for Secret Manager HEC token credentials).
  - **Source (Reader) Node:**
    - **Skipped (No Native Beam Transform):** `org.apache.beam.sdk.io.splunk.SplunkIO` does not provide a native `Read` transform (`webview/src/properties/source/SplunkIO.tsx` intentionally omitted).
  - **Sink (Writer) Node:**
    - [x] **Palette Definition:** Added `SplunkIO` Sink to `NodesCard.tsx` under `Logging Sinks` (`beamTransform: 'SplunkIO', type: 'SINK'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/sink/SplunkIO.tsx` with documented `SplunkIO.Write` (`url`, `tokenSecret` via Secret Manager, `batchCount`, `parallelism`, `disableCertificateValidation`, `rootCaCertificatePath`, `enableBatchLogs`, `enableGzipHttpCompression`) and `SplunkEvent.Builder` (`index`, `source`, `sourceType`, `host`, `eventField`, `timeField`) properties plus `system_instructions`. Registered as `'SINK:SplunkIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/sink/SplunkIO.test.tsx` (100% test coverage including dynamic `getSecrets` message dispatch).
  - [x] **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - [x] **Integration Test Suite:** Standardized sink integration tests split across environments (`src/test/integration/sinks/{agent-engine,cloud-run}/splunk-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> SplunkIO`).
  - **Status:** ✅ Done.

- <a id="io46"></a>**IO46 — `FhirIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [FhirIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/healthcare/FhirIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Native Direction Audit Note:** Both Source (`FhirIO.readResources`, `FhirIO.searchResources`, `FhirIO.exportResourcesToGcs`, `FhirIO.exportResourcesToBigQuery`, `FhirIO.deidentify`, `FhirIO.getPatientEverything`) and Sink (`FhirIO.executeBundles`, `FhirIO.importResources`) are natively supported in `org.apache.beam.sdk.io.gcp.healthcare.FhirIO` and implemented.
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - [x] `getHealthcareDatasets` (`gcloud healthcare datasets list`).
  - **Source (Reader) Node:**
    - [x] **Palette Definition:** Added `FhirIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'FhirIO', type: 'SOURCE'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/source/FhirIO.tsx` with documented `FhirIO.Read` / `Search` / `Export` / `Deidentify` / `getPatientEverything` controls and `getHealthcareDatasets` dynamic discovery. Registered as `'SOURCE:FhirIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/source/FhirIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - [x] **Palette Definition:** Added `FhirIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'FhirIO', type: 'SINK'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/sink/FhirIO.tsx` with documented `FhirIO.Write.executeBundles` and `fhirStoresImport` (`contentStructure`: `BUNDLE`, `RESOURCE`, `BUNDLE_PRETTY`, `RESOURCE_PRETTY`) controls. Registered as `'SINK:FhirIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/sink/FhirIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - [x] **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - [x] **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/fhir-source.{beam,test.ts}` following `FhirIO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/fhir-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> FhirIO`).
  - **Status:** ✅ Done.

- <a id="io47"></a>**IO47 — `HL7v2IO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [HL7v2IO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/healthcare/HL7v2IO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Native Direction Audit Note:** Both Source (`HL7v2IO.read`, `HL7v2IO.readWithFilter`, `HL7v2IO.getAll`) and Sink (`HL7v2IO.ingestMessages` / `HL7v2IO.Write`) are natively supported and implemented. Note that `BATCH_IMPORT` (`HL7v2IO.Write.Mode.BATCH_IMPORT`) is explicitly excluded from Sink write modes because the official Apache Beam JavaDoc states `BATCH_IMPORT` is not yet supported by `HL7v2IO`.
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - [x] `getHealthcareDatasets` (`gcloud healthcare datasets list`).
  - **Source (Reader) Node:**
    - [x] **Palette Definition:** Added `HL7v2IO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'HL7v2IO', type: 'SOURCE'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/source/HL7v2IO.tsx` with documented `HL7v2IO.read` / `readWithFilter` / `getAll` controls (`hl7v2Store`, `filter`, `orderBy`, `initialSplitDuration`). Registered as `'SOURCE:HL7v2IO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/source/HL7v2IO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - [x] **Palette Definition:** Added `HL7v2IO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'HL7v2IO', type: 'SINK'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/sink/HL7v2IO.tsx` with `HL7v2IO.ingestMessages` (`INGEST` mode only; `BATCH_IMPORT` excluded per Beam JavaDoc). Registered as `'SINK:HL7v2IO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/sink/HL7v2IO.test.tsx` (100% test coverage including dynamic message dispatch).
  - [x] **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - [x] **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/hl7v2-source.{beam,test.ts}` following `HL7v2IO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/hl7v2-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> HL7v2IO`).
  - **Status:** ✅ Done.

- <a id="io48"></a>**IO48 — `DicomIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [DicomIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/healthcare/DicomIO.html)
    - **Python SDK:** [DicomIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.gcp.healthcare.dicomio.html)
  - **Native Direction Audit Note:** Both Source (Java `DicomIO.readStudyMetadata` & Python `DicomSearch` with `QIDO_INSTANCE`, `QIDO_SERIES`, `QIDO_STUDY`) and Sink (Python `UploadToDicomStore` with `input_type`: `'bytes' | 'fileio'`) are natively supported in Apache Beam and implemented.
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - [x] `getHealthcareDatasets` (`gcloud healthcare datasets list`).
  - **Source (Reader) Node:**
    - [x] **Palette Definition:** Added `DicomIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'DicomIO', type: 'SOURCE'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/source/DicomIO.tsx` with documented Java `DicomIO.readStudyMetadata` and Python `DicomSearch` controls. Registered as `'SOURCE:DicomIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/source/DicomIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - [x] **Palette Definition:** Added `DicomIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'DicomIO', type: 'SINK'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/sink/DicomIO.tsx` with documented Python `UploadToDicomStore` (`project_id`, `region`, `dataset_id`, `dicom_store_id`, `input_type`, `credential`, `max_workers`, `buffer_size`) controls. Registered as `'SINK:DicomIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/sink/DicomIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - [x] **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - [x] **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/dicom-source.{beam,test.ts}` following `DicomIO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/dicom-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> DicomIO`).
  - **Status:** ✅ Done.

- <a id="io49"></a>**IO49 — `FlinkStreamingImpulseSource`**
  - **Category Alignment:** `Data Services Sources` (Source only; no native Beam writer).
  - **Documentation Links:**
    - **Java SDK:** Not available natively in Java SDK (Not available)
    - **Python SDK:** [FlinkStreamingImpulseSource PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.flink.flink_streaming_impulse_source.html)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the source node for `FlinkStreamingImpulseSource`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `FlinkStreamingImpulseSource` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'FlinkStreamingImpulseSource', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/FlinkStreamingImpulseSource.tsx` with dedicated controls for read targets, limits, Flink JobManager endpoint, and system prompt override. Registered as `'SOURCE:FlinkStreamingImpulseSource'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/FlinkStreamingImpulseSource.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Omitted:** Apache Beam has no native Writer or Sink support for `FlinkStreamingImpulseSource` (it is an unbounded synthetic source). No sink node or property panel is registered.
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Standardized source integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/flinkstreamingimpulse-source.{beam,test.ts}` following `FlinkStreamingImpulseSource -> ParDo -> LogMessage`).
  - **Status:** ✅ Completed (Source panel, unit tests, fixture + integration spec). NOTE: `FlinkStreamingImpulseSource` is Python-only and has no native Beam writer support. The integration fixture is Python-only with `runner: FlinkRunner`.

- <a id="io50"></a>**IO50 — `Firestore IO`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [Firestore IO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/firestore/FirestoreIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getFirestoreDatabases` (`gcloud firestore databases list`).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Firestore IO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Firestore IO` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'FirestoreIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/FirestoreIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:FirestoreIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/FirestoreIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Firestore IO` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'FirestoreIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/FirestoreIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:FirestoreIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/FirestoreIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/firestoreio-pipeline.beam` and `src/test/integration/firestoreio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io51"></a>**IO51 — `Neo4j`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [Neo4j JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/neo4j/Neo4jIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Neo4j`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Neo4j` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'Neo4jIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/Neo4jIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:Neo4jIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/Neo4jIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Neo4j` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'Neo4jIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/Neo4jIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:Neo4jIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/Neo4jIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/neo4j-pipeline.beam` and `src/test/integration/neo4j-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io52"></a>**IO52 — `InfluxDB`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [InfluxDB JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/influxdb/InfluxDbIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `InfluxDB`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `InfluxDB` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'InfluxDbIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/InfluxDbIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:InfluxDbIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/InfluxDbIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `InfluxDB` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'InfluxDbIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/InfluxDbIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:InfluxDbIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/InfluxDbIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/influxdb-pipeline.beam` and `src/test/integration/influxdb-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io53"></a>**IO53 — `SparkReceiverIO (guide)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SparkReceiverIO (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/sparkreceiver/SparkReceiverIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SparkReceiverIO (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SparkReceiverIO (guide)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'SparkReceiverIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SparkReceiverIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SparkReceiverIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SparkReceiverIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SparkReceiverIO (guide)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'SparkReceiverIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SparkReceiverIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SparkReceiverIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SparkReceiverIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/sparkreceiverio-pipeline.beam` and `src/test/integration/sparkreceiverio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io54"></a>**IO54 — `CdapIO (guide)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [CdapIO (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/cdap/CdapIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `CdapIO (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `CdapIO (guide)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'CdapIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CdapIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:CdapIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CdapIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `CdapIO (guide)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'CdapIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CdapIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:CdapIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CdapIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/cdapio-pipeline.beam` and `src/test/integration/cdapio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io55"></a>**IO55 — `SingleStoreDB (guide)`**
  - **Category Alignment:** `Database Sources` (Source) and `Database Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SingleStoreDB (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/singlestore/SingleStoreIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SingleStoreDB (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SingleStoreDB (guide)` Source to `NodesCard.tsx` under `Database Sources` (`beamTransform: 'SingleStoreDBIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SingleStoreDBIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SingleStoreDBIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SingleStoreDBIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SingleStoreDB (guide)` Sink to `NodesCard.tsx` under `Database Sinks` (`beamTransform: 'SingleStoreDBIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SingleStoreDBIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SingleStoreDBIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SingleStoreDBIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/singlestoredb-pipeline.beam` and `src/test/integration/singlestoredb-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io56"></a>**IO56 — `GoogleAdsIO`**
  - **Category Alignment:** `Data Services Sources` (Source ONLY).
  - **Documentation Links:**
    - **Java SDK:** [GoogleAdsIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/googleads/GoogleAdsIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Native Direction Audit Note:** `SINK:GoogleAdsIO` was intentionally skipped because `org.apache.beam.sdk.io.googleads.GoogleAdsIO` (`GoogleAdsV23`) only provides native `Read` / `ReadAll` transforms (`GoogleAdsIO.current().read()` and `GoogleAdsIO.current().readAll()`) for querying Google Ads via GAQL and has no native `Write` transform in Apache Beam.
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - [x] `getSecrets` (`gcloud secrets list` for Secret Manager developer token and OAuth2 credentials).
  - **Source (Reader) Node:**
    - [x] **Palette Definition:** Added `GoogleAdsIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'GoogleAdsIO', type: 'SOURCE'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/source/GoogleAdsIO.tsx` with documented `GoogleAdsV23.Read` / `ReadAll` (`readMode`, `customerId`, `loginCustomerId`, `linkedCustomerId`, `query`) and `GoogleAdsOptions` (`authMode`, `developerTokenSecret`, `clientId`, `clientSecretSecret`, `refreshTokenSecret`, `googleAdsEndpoint`) controls plus `system_instructions`. Registered as `'SOURCE:GoogleAdsIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/source/GoogleAdsIO.test.tsx` (100% test coverage including dynamic `getSecrets` message dispatch).
  - **Sink (Writer) Node:**
    - **Skipped (No Native Beam Transform):** `org.apache.beam.sdk.io.googleads.GoogleAdsIO` does not provide a native `Write` transform (`webview/src/properties/sink/GoogleAdsIO.tsx` intentionally omitted).
  - [x] **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - [x] **Integration Test Suite:** Standardized source integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/googleads-source.{beam,test.ts}` following `GoogleAdsIO -> ParDo -> LogMessage`).
  - **Status:** ✅ Done.

- <a id="io57"></a>**IO57 — `Web APIs (guide)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [Web APIs (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/io/requestresponse/RequestResponseIO.html)
    - **Python SDK:** [Web APIs (guide) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.requestresponse.html?highlight=requestresponse#apache_beam.io.requestresponse.RequestResponseIO)
  - **Native Direction Audit Note:** Both Source (`SOURCE:RequestResponseIO`) and Sink (`SINK:RequestResponseIO`) are implemented per the official Java (`org.apache.beam.io.requestresponse.RequestResponseIO`) and Python (`apache_beam.io.requestresponse.RequestResponseIO`) documentation (`"PTransform for reading from and writing to Web APIs"`).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - [x] `getSecrets` (`gcloud secrets list` for API tokens/credentials via Secret Manager).
  - **Source (Reader) Node:**
    - [x] **Palette Definition:** Added `Web APIs (guide)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'RequestResponseIO', type: 'SOURCE'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/source/RequestResponseIO.tsx` with documented `Caller` (`endpointUrl`, `httpMethod`, `requestCoder`, `responseCoder`), `SetupTeardown` Secret Manager auth (`authMode`, `secretName`, `authHeaderName`), resilience (`timeout`, `enableRepeater` / `.withoutRepeater()`, `enableThrottler` / `DefaultThrottler`, `overloadRatio`), and Redis cache (`enableCache`, `redisUri`, `cacheTtlSeconds`) controls. Registered as `'SOURCE:RequestResponseIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/source/RequestResponseIO.test.tsx` (100% test coverage including dynamic `getSecrets` message dispatch).
  - **Sink (Writer) Node:**
    - [x] **Palette Definition:** Added `Web APIs (guide)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'RequestResponseIO', type: 'SINK'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/sink/RequestResponseIO.tsx` with documented `Caller` (`endpointUrl`, `httpMethod`, `requestCoder`, `responseCoder`), Secret Manager auth (`authMode`, `secretName`, `authHeaderName`), `timeout`, `enableRepeater`, `enableThrottler`, `overloadRatio`, and `RedisCache` controls. Registered as `'SINK:RequestResponseIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/sink/RequestResponseIO.test.tsx` (100% test coverage including dynamic `getSecrets` message dispatch).
  - [x] **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - [x] **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/webapis-source.{beam,test.ts}` following `RequestResponseIO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/webapis-sink.{beam,test.ts}` following `Create -> ParDo -> RequestResponseIO`).
  - **Status:** ✅ Done.

- <a id="io58"></a>**IO58 — `Iceberg (guide)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [Iceberg (guide) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/managed/Managed.html)
    - **Python SDK:** [Iceberg (guide) PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.transforms.managed.html#module-apache_beam.transforms.managed)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Iceberg (guide)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Iceberg (guide)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'IcebergIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/IcebergIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:IcebergIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/IcebergIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Iceberg (guide)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'IcebergIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/IcebergIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:IcebergIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/IcebergIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/iceberg-pipeline.beam` and `src/test/integration/iceberg-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io59"></a>**IO59 — `CsvIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [CsvIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/csv/CsvIO.html)
    - **Python SDK:** [CsvIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.textio.html#apache_beam.io.textio.ReadFromCsv)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `CsvIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `CsvIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'CsvIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CsvIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:CsvIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CsvIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `CsvIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'CsvIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CsvIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:CsvIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CsvIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/csvio-pipeline.beam` and `src/test/integration/csvio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io60"></a>**IO60 — `JsonIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [JsonIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/json/JsonIO.html)
    - **Python SDK:** [JsonIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.io.textio.html#apache_beam.io.textio.ReadFromJson)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `JsonIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `JsonIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'JsonIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/JsonIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:JsonIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/JsonIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `JsonIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'JsonIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/JsonIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:JsonIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/JsonIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/jsonio-pipeline.beam` and `src/test/integration/jsonio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io61"></a>**IO61 — `ContextualTextIO`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [ContextualTextIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/contextualtextio/ContextualTextIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `ContextualTextIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `ContextualTextIO` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'ContextualTextIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/ContextualTextIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:ContextualTextIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/ContextualTextIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `ContextualTextIO` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'ContextualTextIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/ContextualTextIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:ContextualTextIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/ContextualTextIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/contextualtextio-pipeline.beam` and `src/test/integration/contextualtextio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io62"></a>**IO62 — `PulsarIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [PulsarIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/pulsar/PulsarIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `PulsarIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `PulsarIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'PulsarIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/PulsarIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:PulsarIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/PulsarIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `PulsarIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'PulsarIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/PulsarIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:PulsarIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/PulsarIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/pulsar-source.{beam,test.ts}` following `PulsarIO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/pulsar-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> PulsarIO`).
  - **Status:** ✅ Completed (Source + Sink panels, 35 unit tests, fixture + integration spec). Uses the shared `ExpansionServiceFields` primitive for the Python x-lang group. NOTE: panels were decomposed into `components/common/pulsar/PulsarConnectionFields.tsx` and `PulsarAuthFields.tsx` to stay within repo file-size norms; the client URL (`pulsar://`) and admin URL (`http://`) are separate fields because Beam's `PulsarIO` requires both.

- <a id="io63"></a>**IO63 — `SolaceIO`**
  - **Category Alignment:** `Streaming Sources` (Source) and `Streaming Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [SolaceIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/solace/SolaceIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SolaceIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SolaceIO` Source to `NodesCard.tsx` under `Streaming Sources` (`beamTransform: 'SolaceIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SolaceIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:SolaceIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SolaceIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SolaceIO` Sink to `NodesCard.tsx` under `Streaming Sinks` (`beamTransform: 'SolaceIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SolaceIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:SolaceIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SolaceIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Standardized source and sink integration tests split across environments (`src/test/integration/sources/{agent-engine,cloud-run}/solace-source.{beam,test.ts}` following `SolaceIO -> ParDo -> LogMessage` and `src/test/integration/sinks/{agent-engine,cloud-run}/solace-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> SolaceIO`).
  - **Status:** ✅ Completed (Source + Sink panels, 32 unit tests, fixture + integration spec). Uses the shared `ExpansionServiceFields` primitive for the Python x-lang group. NOTE: the connection block was intentionally NOT extracted into a shared component — the Source needs both a SEMP management host (HTTPS :943) and a JCSMP messaging host (SMF :55555) while the Sink needs only JCSMP, so sharing would require internal branching for no real reuse benefit.

- <a id="io64"></a>**IO64 — `DatadogIO`**
  - **Category Alignment:** `Logging Sinks` (Sink ONLY).
  - **Documentation Links:**
    - **Java SDK:** [DatadogIO JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/datadog/DatadogIO.html)
    - **Python SDK:** [DatadogIO PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.transforms.xlang.io.html#apache_beam.transforms.xlang.io.DatadogWrite)
  - **Native Direction Audit Note:** `SOURCE:DatadogIO` was intentionally skipped because `org.apache.beam.sdk.io.datadog.DatadogIO` and Python `apache_beam.transforms.xlang.io.DatadogWrite` only provide a native `Write` sink (`DatadogIO.Write` / `DatadogWrite` for Datadog Logs HTTP Intake API) and have no native `Read` transform in Apache Beam.
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - [x] `getSecrets` (`gcloud secrets list` for Secret Manager Datadog API key credentials).
  - **Source (Reader) Node:**
    - **Skipped (No Native Beam Transform):** Neither `org.apache.beam.sdk.io.datadog.DatadogIO` nor Python `DatadogWrite` provides a native `Read` transform (`webview/src/properties/source/DatadogIO.tsx` intentionally omitted).
  - **Sink (Writer) Node:**
    - [x] **Palette Definition:** Added `DatadogIO` Sink to `NodesCard.tsx` under `Logging Sinks` (`beamTransform: 'DatadogIO', type: 'SINK'`).
    - [x] **Property Panel Plan:** Implemented `webview/src/properties/sink/DatadogIO.tsx` with documented `DatadogIO.Write` / `DatadogWrite` (`url` with regional intake presets US1, US3, US5, EU1, AP1, US1-FED, `apiKeySecret` via Secret Manager, `batchCount`, `minBatchCount`, `maxBufferSize`, `parallelism`) and `DatadogEvent.Builder` (`ddsource`, `ddtags`, `hostname`, `service`, `messageField`) controls plus `system_instructions`. Registered as `'SINK:DatadogIO'` in `PropertyForm.tsx`.
    - [x] **Test Suite:** `webview/src/properties/sink/DatadogIO.test.tsx` (100% test coverage including dynamic `getSecrets` message dispatch).
  - [x] **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - [x] **Integration Test Suite:** Standardized sink integration tests split across environments (`src/test/integration/sinks/{agent-engine,cloud-run}/datadog-sink.{beam,test.ts}` following `GenerateSequence -> ParDo -> DatadogIO`).
  - **Status:** ✅ Done.

- <a id="io65"></a>**IO65 — `CosmosIO (Azure Cosmos DB)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [CosmosIO (Azure Cosmos DB) JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/azure/cosmos/CosmosIO.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `CosmosIO (Azure Cosmos DB)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `CosmosIO (Azure Cosmos DB)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'CosmosIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CosmosIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:CosmosIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CosmosIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `CosmosIO (Azure Cosmos DB)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'CosmosIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CosmosIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:CosmosIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CosmosIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/cosmosio-pipeline.beam` and `src/test/integration/cosmosio-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io66"></a>**IO66 — `AzureBlobStoreFileSystem`**
  - **Category Alignment:** `File Sources` (Source) and `File Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [AzureBlobStoreFileSystem JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/azure/blobstore/AzureBlobStoreFileSystemRegistrar.html)
    - **Python SDK:** (not available natively; use the x-lang option to call the Java version via `apache_beam.transforms.xlang` / expansion service)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getStorageBuckets` (`gcloud storage buckets list` for GCS bucket selection in datalist).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `AzureBlobStoreFileSystem`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `AzureBlobStoreFileSystem` Source to `NodesCard.tsx` under `File Sources` (`beamTransform: 'AzureBlobStoreFileSystem', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/AzureBlobStoreFileSystem.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:AzureBlobStoreFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/AzureBlobStoreFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `AzureBlobStoreFileSystem` Sink to `NodesCard.tsx` under `File Sinks` (`beamTransform: 'AzureBlobStoreFileSystem', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/AzureBlobStoreFileSystem.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:AzureBlobStoreFileSystem'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/AzureBlobStoreFileSystem.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/azureblobstorefilesystem-pipeline.beam` and `src/test/integration/azureblobstorefilesystem-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ✅ Done (Panels, unit tests, palette + registry wiring, and integration fixture landed).

- <a id="io67"></a>**IO67 — `Delta Lake`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink).
  - **Documentation Links:**
    - **Java SDK:** [Delta Lake JavaDoc](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/managed/Managed.html)
    - **Python SDK:** [Delta Lake PyDoc](https://beam.apache.org/releases/pydoc/current/apache_beam.transforms.managed.html#module-apache_beam.transforms.managed)
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Delta Lake`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Delta Lake` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'DeltaLakeIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/DeltaLakeIO.tsx` with dedicated controls for read targets, authentication, limits, and system prompt override. Registered as `'SOURCE:DeltaLakeIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/DeltaLakeIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Delta Lake` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'DeltaLakeIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/DeltaLakeIO.tsx` with dedicated controls for write destination, serialization/encoding, delivery guarantees/sharding, and system prompt override. Registered as `'SINK:DeltaLakeIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/DeltaLakeIO.test.tsx` (100% test coverage including dynamic message dispatch).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), InfoTooltips, collapsible parameter groups, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/deltalake-pipeline.beam` and `src/test/integration/deltalake-pipeline.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⏭️ SKIPPED — no first-party Apache Beam Delta Lake connector could be
    confirmed. Managed I/O officially covers **Iceberg, Kafka, and BigQuery** only; Delta Lake
    appears in Beam's roadmap/"expanding ecosystem" language, but no `Managed.DELTA_LAKE`
    constant or `"deltalake"` managed key was verified in the SDK. Both documentation links
    above point at the generic `Managed` API rather than at a Delta Lake connector, which is
    the tell. Shipping a palette node whose generated code cannot compile is worse than
    omitting the connector. Revisit if/when Beam publishes a Delta Lake managed key.


---

### 7.2 Other & Community I/O Connectors (IO68 – IO79)

- <a id="io68"></a>**IO68 — `Cloud Bigtable (HBase based)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Java`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [Cloud Bigtable (HBase based) Repository / Documentation](https://cloud.google.com/bigtable/docs/hbase-dataflow-java)
    - **Target Language:** `Java` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getBigtableInstances` (`gcloud bigtable instances list`); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Cloud Bigtable (HBase based)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Cloud Bigtable (HBase based)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'CloudBigtable', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CloudBigtable.tsx` registered as `'SOURCE:CloudBigtable'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CloudBigtable.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Cloud Bigtable (HBase based)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'CloudBigtable', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CloudBigtable.tsx` registered as `'SINK:CloudBigtable'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CloudBigtable.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/cloudbigtable-hbase.beam` and `src/test/integration/cloudbigtable-hbase.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io69"></a>**IO69 — `Cognite Data Fusion`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Java`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [Cognite Data Fusion Repository / Documentation](https://github.com/cognitedata/cdf-beam-connector-java)
    - **Target Language:** `Java` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Cognite Data Fusion`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Cognite Data Fusion` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'CogniteDataFusion', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CogniteDataFusion.tsx` registered as `'SOURCE:CogniteDataFusion'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CogniteDataFusion.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Cognite Data Fusion` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'CogniteDataFusion', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CogniteDataFusion.tsx` registered as `'SINK:CogniteDataFusion'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CogniteDataFusion.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/cognitedatafusion.beam` and `src/test/integration/cognitedatafusion.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io70"></a>**IO70 — `KineticaDB`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Java`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [KineticaDB Repository / Documentation](https://github.com/kineticadb/kinetica-connector-beam)
    - **Target Language:** `Java` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `KineticaDB`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `KineticaDB` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'KineticaDB', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/KineticaDB.tsx` registered as `'SOURCE:KineticaDB'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/KineticaDB.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `KineticaDB` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'KineticaDB', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/KineticaDB.tsx` registered as `'SINK:KineticaDB'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/KineticaDB.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/kineticadb.beam` and `src/test/integration/kineticadb.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io71"></a>**IO71 — `SAP Hana to Google BigQuery`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Java`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [SAP Hana to Google BigQuery Repository / Documentation](https://github.com/google/hana-bq-beam-connector)
    - **Target Language:** `Java` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getDatasets` / `getTables` (`bq ls / gcloud bigquery`); `getSecrets` (`gcloud secrets list` for Secret Manager credentials).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `SAP Hana to Google BigQuery`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `SAP Hana to Google BigQuery` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'SAPHanatoGoogleBigQuery', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/SAPHanatoGoogleBigQuery.tsx` registered as `'SOURCE:SAPHanatoGoogleBigQuery'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/SAPHanatoGoogleBigQuery.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `SAP Hana to Google BigQuery` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'SAPHanatoGoogleBigQuery', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/SAPHanatoGoogleBigQuery.tsx` registered as `'SINK:SAPHanatoGoogleBigQuery'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/SAPHanatoGoogleBigQuery.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/saphana-to-bigquery.beam` and `src/test/integration/saphana-to-bigquery.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io72"></a>**IO72 — `TrepWsIO`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Java`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [TrepWsIO Repository / Documentation](https://github.com/Refinitiv/trep-websockets-beam-io)
    - **Target Language:** `Java` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `TrepWsIO`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `TrepWsIO` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'TrepWsIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/TrepWsIO.tsx` registered as `'SOURCE:TrepWsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/TrepWsIO.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `TrepWsIO` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'TrepWsIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/TrepWsIO.tsx` registered as `'SINK:TrepWsIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/TrepWsIO.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/trepwsio.beam` and `src/test/integration/trepwsio.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io73"></a>**IO73 — `Beam PyIO (Collection of Python IO connectors)`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Python`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [Beam PyIO (Collection of Python IO connectors) Repository / Documentation](https://github.com/beam-pyio)
    - **Target Language:** `Python` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Beam PyIO (Collection of Python IO connectors)`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Beam PyIO (Collection of Python IO connectors)` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'BeamPyIO', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/BeamPyIO.tsx` registered as `'SOURCE:BeamPyIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/BeamPyIO.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Beam PyIO (Collection of Python IO connectors)` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'BeamPyIO', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/BeamPyIO.tsx` registered as `'SINK:BeamPyIO'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/BeamPyIO.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/beampyio.beam` and `src/test/integration/beampyio.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io74"></a>**IO74 — `Cloud SQL`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Python`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [Cloud SQL Repository / Documentation](https://github.com/jccatrinck/dataflow-cloud-sql-python)
    - **Target Language:** `Python` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Cloud SQL`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Cloud SQL` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'CloudSQL', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/CloudSQL.tsx` registered as `'SOURCE:CloudSQL'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/CloudSQL.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Cloud SQL` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'CloudSQL', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/CloudSQL.tsx` registered as `'SINK:CloudSQL'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/CloudSQL.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/cloudsql.beam` and `src/test/integration/cloudsql.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io75"></a>**IO75 — `MySQL`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Python`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [MySQL Repository / Documentation](https://github.com/esakik/beam-mysql-connector)
    - **Target Language:** `Python` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `MySQL`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `MySQL` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'MySQL', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/MySQL.tsx` registered as `'SOURCE:MySQL'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/MySQL.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `MySQL` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'MySQL', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/MySQL.tsx` registered as `'SINK:MySQL'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/MySQL.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/mysql.beam` and `src/test/integration/mysql.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io76"></a>**IO76 — `Pyodbc`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Python`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [Pyodbc Repository / Documentation](https://github.com/314e/beam-pyodbc-connector)
    - **Target Language:** `Python` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Pyodbc`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Pyodbc` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'Pyodbc', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/Pyodbc.tsx` registered as `'SOURCE:Pyodbc'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/Pyodbc.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Pyodbc` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'Pyodbc', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/Pyodbc.tsx` registered as `'SINK:Pyodbc'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/Pyodbc.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/pyodbc.beam` and `src/test/integration/pyodbc.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io77"></a>**IO77 — `Tinybird`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Python`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [Tinybird Repository / Documentation](https://github.com/tinybirdco/tinybird-beam)
    - **Target Language:** `Python` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Tinybird`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Tinybird` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'Tinybird', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/Tinybird.tsx` registered as `'SOURCE:Tinybird'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/Tinybird.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Tinybird` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'Tinybird', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/Tinybird.tsx` registered as `'SINK:Tinybird'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/Tinybird.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/tinybird.beam` and `src/test/integration/tinybird.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io78"></a>**IO78 — `Go Connect`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Go`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [Go Connect Repository / Documentation](https://github.com/amient/goconnect)
    - **Target Language:** `Go` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `Go Connect`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `Go Connect` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'GoConnect', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/GoConnect.tsx` registered as `'SOURCE:GoConnect'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/GoConnect.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `Go Connect` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'GoConnect', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/GoConnect.tsx` registered as `'SINK:GoConnect'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/GoConnect.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/goconnect.beam` and `src/test/integration/goconnect.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

- <a id="io79"></a>**IO79 — `MySQL, PostgreSQL, Oracle, SQL Server`**
  - **Category Alignment:** `Data Services Sources` (Source) and `Data Services Sinks` (Sink) (Target Language: `Yaml`).
  - **Documentation Links:**
    - **Primary Documentation / Repository:** [MySQL, PostgreSQL, Oracle, SQL Server Repository / Documentation](https://beam.apache.org/releases/yamldoc/current/#readfrommysql)
    - **Target Language:** `Yaml` (When used in Python/Java, utilize native connector or cross-language bridge).
  - **Usability & Dynamic Discovery (`gcloud` / CLI):**
    - `getSecrets` (`gcloud secrets list` for API tokens/credentials if authentication required).
  - **Scope Isolation:** Strictly isolated: Do NOT modify other nodes in the project. Only add the 2 new nodes for `MySQL, PostgreSQL, Oracle, SQL Server`.
  - **Source (Reader) Node:**
    - **Palette Definition:** Add `MySQL, PostgreSQL, Oracle, SQL Server` Source to `NodesCard.tsx` under `Data Services Sources` (`beamTransform: 'MySQLPostgreSQLOracleSQLServer', type: 'SOURCE'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/source/MySQLPostgreSQLOracleSQLServer.tsx` registered as `'SOURCE:MySQLPostgreSQLOracleSQLServer'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/source/MySQLPostgreSQLOracleSQLServer.test.tsx` (100% test coverage).
  - **Sink (Writer) Node:**
    - **Palette Definition:** Add `MySQL, PostgreSQL, Oracle, SQL Server` Sink to `NodesCard.tsx` under `Data Services Sinks` (`beamTransform: 'MySQLPostgreSQLOracleSQLServer', type: 'SINK'`).
    - **Property Panel Plan:** Review documentation to find all possible properties and their value(s), then come up with a plan for the property panel before generating the panel (strictly no guessing of valid properties). Create `webview/src/properties/sink/MySQLPostgreSQLOracleSQLServer.tsx` registered as `'SINK:MySQLPostgreSQLOracleSQLServer'` in `PropertyForm.tsx`.
    - **Test Suite:** `webview/src/properties/sink/MySQLPostgreSQLOracleSQLServer.test.tsx` (100% test coverage).
  - **Property Panel Layout & Styling:** Adheres strictly to the 8pt grid system, VS Code theme tokens (`--vscode-*`), info tooltips, and LLM prompt override textarea (`system_instructions`).
  - **Integration Test Suite:** Generate at least one new end-to-end integration test (`src/test/integration/multidb-yaml.beam` and `src/test/integration/multidb-yaml.test.ts`) exercising the connector in a realistic pipeline DAG validated against the Multi-Agent Evaluation Harness.
  - **Status:** ⬜ Not Started.

---

## Appendix: Investigated & Cleared

Recorded so these are not re-reviewed:

- **XSS via `dangerouslySetInnerHTML`** — *not exploitable as written.* `highlightCode` escapes `&`, `<`, `>`
  before tokenising ([SourceCodeTab.tsx:62-65](file:///Users/mikenimer/Development/projects/apache-beam-designer/webview/src/components/BottomPanel/SourceCodeTab.tsx#L62-L65)),
  and token contents are built from already-escaped text with hardcoded class names. `$`-substitution can
  duplicate escaped text but cannot unescape it. Tracked as correctness + defence-in-depth under **M2/M11**.
- **`readFileContent` path traversal** — *correctly defended* at
  [extension.ts:1593-1604](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1593-L1604)
  (resolve + `relative` + `..`/absolute rejection). This is the pattern C1 should copy.
- **`deleteCodeFiles` deleting outside the workspace** — *correctly defended* at
  [extension.ts:892-898](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L892-L898).
  The C3 risk is deletion of legitimate user files *inside* the workspace, not escape.
- **`folderPath` redeclared in the same `switch`** ([1526](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1526) / [1708](file:///Users/mikenimer/Development/projects/apache-beam-designer/src/extension.ts#L1708)) —
  not a collision; the second sits inside a nested `if (runUri) {}` block.
- **Compilation** — `npx tsc -p ./ --noEmit` passes with zero errors.
- **`gemini.log` committed to git** — no; root `.gitignore` covers `*.log`. The real exposure is the Cloud
  Build upload path (**M15**).
