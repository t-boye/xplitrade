#!/bin/bash

echo "Running Unit tests"

pytest --random-order --cov=xplitrade --cov-config=.coveragerc tests/
