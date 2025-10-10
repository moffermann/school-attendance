"""Notification template rendering."""


class NotificationTemplating:
    def render(self, template: str, variables: dict[str, str]) -> str:
        safe_vars = {k: str(v) for k, v in variables.items()}
        return template.format_map(DefaultDict(safe_vars))


class DefaultDict(dict):
    def __missing__(self, key):  # type: ignore[override]
        return f"{{{key}}}"
