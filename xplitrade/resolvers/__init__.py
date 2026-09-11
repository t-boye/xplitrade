# flake8: noqa: F401
# isort: off
from xplitrade.resolvers.iresolver import IResolver
from xplitrade.resolvers.exchange_resolver import ExchangeResolver

# isort: on
# Don't import HyperoptResolver to avoid loading the whole Optimize tree
# from xplitrade.resolvers.hyperopt_resolver import HyperOptResolver
from xplitrade.resolvers.pairlist_resolver import PairListResolver
from xplitrade.resolvers.protection_resolver import ProtectionResolver
from xplitrade.resolvers.strategy_resolver import StrategyResolver
