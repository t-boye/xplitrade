# ensure users can still use a non-torch freqai version
try:
    from xplitrade.freqai.tensorboard.lightgbm_callback import LightGBMTensorboardCallback
    from xplitrade.freqai.tensorboard.tensorboard import TensorBoardCallback, TensorboardLogger

    TBLogger = TensorboardLogger
    TBCallback = TensorBoardCallback
    LightGBMCallback = LightGBMTensorboardCallback
except ModuleNotFoundError:
    from xplitrade.freqai.tensorboard.base_tensorboard import (
        BaseTensorBoardCallback,
        BaseTensorboardLogger,
    )

    TBLogger = BaseTensorboardLogger  # type: ignore
    TBCallback = BaseTensorBoardCallback  # type: ignore
    LightGBMCallback = None  # type: ignore

__all__ = ("TBLogger", "TBCallback", "LightGBMCallback")
