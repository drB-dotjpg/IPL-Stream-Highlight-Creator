#!/bin/bash
#echo $@ >> exec.cmd

cmd="/usr/local/bin/ffmpeg $@"
eval $cmd