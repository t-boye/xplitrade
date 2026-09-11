#!/usr/bin/env python3
"""
Main Xplitrade bot script.
Read the documentation to know what cli arguments you need.
"""

import logging
import sys


# check min. python version
if sys.version_info < (3, 11):  # pragma: no cover  # noqa: UP036
    sys.exit("Xplitrade requires Python version >= 3.11")

from xplitrade import __version__
from xplitrade.commands import Arguments
from xplitrade.constants import DOCS_LINK
from xplitrade.exceptions import ConfigurationError, XplitradeException, OperationalException
from xplitrade.loggers import setup_logging_pre
from xplitrade.system import (
    asyncio_setup,
    gc_set_threshold,
    print_version_info,
    set_mp_start_method,
)


logger = logging.getLogger("xplitrade")


def main(sysargv: list[str] | None = None) -> None:
    """
    This function will initiate the bot and start the trading loop.
    :return: None
    """

    return_code: int | None = None
    try:
        setup_logging_pre()
        asyncio_setup()
        arguments = Arguments(sysargv)
        args = arguments.get_parsed_arg()

        # Call subcommand.
        if args.get("version") or args.get("version_main"):
            print_version_info()
            return_code = 0
        elif "func" in args:
            logger.info(f"xplitrade {__version__}")
            gc_set_threshold()
            set_mp_start_method()
            return_code = args["func"](args)
        else:
            # No subcommand was issued.
            raise OperationalException(
                "Usage of Xplitrade requires a subcommand to be specified.\n"
                "To have the bot executing trades in live/dry-run modes, "
                "depending on the value of the `dry_run` setting in the config, run Xplitrade "
                "as `xplitrade trade [options...]`.\n"
                "To see the full list of options available, please use "
                "`xplitrade --help` or `xplitrade <command> --help`."
            )

    except KeyboardInterrupt:
        logger.info("SIGINT received, aborting ...")
        return_code = 130
    except ConfigurationError as e:
        logger.error(
            f"Configuration error: {e}\n"
            f"Please make sure to review the documentation at {DOCS_LINK}."
        )
    except XplitradeException as e:
        logger.error(str(e))
        return_code = 2
    except Exception:
        logger.exception("Fatal exception!")
        return_code = 1
    finally:
        sys.exit(return_code)


if __name__ == "__main__":  # pragma: no cover
    main()
