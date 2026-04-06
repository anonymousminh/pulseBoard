from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone
from typing import Literal

class MetricRecord(BaseModel):
    repo: str
    metric_name: str
    value: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("metric_name")
    @classmethod
    def must_be_known_metrics(cls, v):
        allowed = {
            "weekly_commit_count",
            "open_issues_count",
            "avg_pr_merge_time_hours",
            "weekly_code_additions"
        }

        if v not in allowed:
            raise ValueError(f"Unknown metric: {v}")
        return v

class IngestionRun(BaseModel):
    repo: str
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: Literal["success", "partial", "error"]

