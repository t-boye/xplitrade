ARG sourceimage=xplitradeorg/xplitrade
ARG sourcetag=develop
FROM ${sourceimage}:${sourcetag}

# Install dependencies
COPY requirements-plot.txt /xplitrade/

RUN pip install -r requirements-plot.txt --user --no-cache-dir
