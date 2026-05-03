# Cygnus Demo — Sentry (Python)

Verify the supply chain of [Sentry](https://github.com/getsentry/sentry), the debugging platform with 40K+ GitHub stars. 30+ Python dependencies verified.

## Try it

```bash
git clone https://github.com/blackswan-software/cygnus-demo-sentry.git
cd cygnus-demo-sentry
curl -fsSL https://install.blackswan-software.ai | sh
cygnus verify
```

## What you'll see

```
requests@2.33.1    FULLY_VERIFIED    177 FV    0 CVEs
boto3@1.35.81      FULLY_VERIFIED     FV      0 CVEs
click@8.1.8        FULLY_VERIFIED     FV      0 CVEs
celery@5.4.0       FULLY_VERIFIED     FV      0 CVEs
numpy@1.26.4       FULLY_VERIFIED     FV      5 CVEs ⚠ GHSA-2fc2-6r4j-p65h, GHSA-5545-2q6w-2gh6 ...
sqlalchemy@2.0.36  FULLY_VERIFIED     FV      0 CVEs
fastapi@0.115.6    FULLY_VERIFIED     FV      0 CVEs
...

CVE source: osv.dev (235 known vulnerabilities across 51 scanned libraries)
```

## SBOM

```bash
cygnus sbom --format cyclonedx > sbom.json
```

Signed CycloneDX 1.5 SBOM with verification grades and CVE status for every dependency.

## Audit document

```bash
cygnus verify --audit > audit.json
```

Signed verification report with provenance chain. Cryptographic proof, not a checklist.

## Benchmarks (real data, n=20 per library)

| Library | AI hallucination rate | AI param accuracy | Improvement |
|---------|----------------------|-------------------|-------------|
| boto3 | 25% → 20% | 65% → 92% | **+27pp accuracy** |
| click | 50% → 45% | 53% → 71% | **+18pp accuracy** |
| celery | 45% → 50% | 72% → 89% | **+17pp accuracy** |
| requests | 40% → 35% | 92% → 98% | **+6pp accuracy** |
| numpy | 10% → 15% | 69% → 80% | **+11pp accuracy** |
| sqlalchemy | 80% → 80% | 52% → 68% | **+16pp accuracy** |
| fastapi | 100% → 80% | 48% → 51% | **-20pp hallucination** |

*Without Cygnus → With Cygnus verified tokens. Each test: n=20 AI-generated function calls.*

## Links

- [Cygnus](https://blackswan-software.ai) — The Certificate Authority for Software Libraries
- [Sentry](https://github.com/getsentry/sentry) — Debugging platform

## License

Demo: MIT. Sentry: FSL-1.1-Apache-2.0 (upstream).
