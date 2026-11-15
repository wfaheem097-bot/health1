from dataclasses import asdict

from .analyzers import Analysis, RuleBasedAnalyzer
from ..core.config import BASELINE


class AnalysisService:
    def __init__(self):
        self.provider = RuleBasedAnalyzer()

    def analyze(self, rows: list[dict]) -> Analysis:
        return self.provider.analyze(rows, BASELINE.copy())

    def explain(self, rows: list[dict]) -> dict:
        result = self.analyze(rows)
        return {"timestamp": rows[-1]["timestamp"], **asdict(result)}
