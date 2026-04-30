from typing import Literal

Mode = Literal["billboard", "connection"]


class ModeManager:
    """
    Minimal mode manager scaffold.
    Full state transitions and timeout rules can be implemented later.
    """

    @staticmethod
    def validate_mode(mode: str) -> bool:
        return mode in ("billboard", "connection")
