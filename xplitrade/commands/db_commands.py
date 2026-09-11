import logging
from typing import Any

from xplitrade.enums import RunMode


logger = logging.getLogger(__name__)


def start_convert_db(args: dict[str, Any]) -> None:

    from xplitrade.configuration.config_setup import setup_utils_configuration
    from xplitrade.persistence import Trade, init_db
    from xplitrade.persistence.db_migration import migrate_db

    config = setup_utils_configuration(args, RunMode.UTIL_NO_EXCHANGE)

    init_db(config["db_url"])
    session_target = Trade.session
    init_db(config["db_url_from"])
    logger.info("Starting db migration.")
    migrate_db(session_target)
