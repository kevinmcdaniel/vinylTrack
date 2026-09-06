#!/usr/bin/env python3
"""Render a Bruno JUnit report as a GitHub job summary (#41).

`bru run --reporter-junit` writes one <testsuite> per request and one
<testcase> per assertion/test. The runner already prints the full log, but the
interesting lines are easy to lose in it, so this pulls just the failures into
the job summary.

`test:api` runs with `--bail`, so a failing run stops at the first bad request
and every later request is emitted as an empty <testsuite skipped="1">. Those
are counted and reported separately — otherwise the pass/fail totals describe
only the handful of requests that ran and badly understate the collection.

Usage: bruno-summary.py <junit.xml>   (writes markdown to stdout)
"""

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_ROWS = 50


def cell(text: str) -> str:
    """Keep a message from breaking out of its markdown table cell."""
    return " ".join(text.split()).replace("|", "\\|") or "—"


def main() -> int:
    print("### Bruno API collection\n")

    if len(sys.argv) != 2:
        print(f"Usage: {Path(sys.argv[0]).name} <junit.xml>", file=sys.stderr)
        return 2

    report = Path(sys.argv[1])
    if not report.is_file():
        # The collection never ran (the API failed to boot, say). The step that
        # actually failed owns the error; just don't imply everything passed.
        print("No JUnit report was produced — the collection did not run.")
        return 0

    try:
        root = ET.parse(report).getroot()
    except ET.ParseError as error:
        print(f"Could not parse `{report.name}`: {error}")
        return 0

    requests = skipped = assertions = 0
    failures = []
    for suite in root.iter("testsuite"):
        requests += 1
        cases = suite.findall("testcase")
        # --bail leaves later requests as empty, skipped suites.
        if not cases and suite.get("skipped") == "1":
            skipped += 1
            continue
        for case in cases:
            assertions += 1
            failure = case.find("failure")
            if failure is not None:
                failures.append(
                    (suite.get("name", "?"), case.get("name", "?"), failure.get("message") or "")
                )

    if not requests:
        print("The report contained no requests.")
        return 0

    if not failures:
        if skipped:
            # No failed assertion but requests went unrun — e.g. a request errored
            # outright. Say so rather than calling it a pass.
            print(f"**{skipped}** of **{requests}** requests did not run. See the `bruno-junit` artifact.")
            return 0
        print(f"All **{assertions}** assertions passed across **{requests}** requests.")
        return 0

    print(f"**{len(failures)}** of **{assertions}** assertions failed ({assertions - len(failures)} passed).\n")
    if skipped:
        print(
            f"`--bail` stopped the run at the first failing request — "
            f"**{skipped}** of **{requests}** requests never ran, so those totals "
            f"cover only what executed.\n"
        )

    print("| Request | Assertion | Failure |")
    print("| --- | --- | --- |")
    for request, assertion, message in failures[:MAX_ROWS]:
        print(f"| `{cell(request)}` | {cell(assertion)} | {cell(message)} |")

    if len(failures) > MAX_ROWS:
        print(f"\n…and {len(failures) - MAX_ROWS} more — see the `bruno-junit` artifact.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
