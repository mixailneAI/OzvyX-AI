#!/data/data/com.termux/files/usr/bin/bash
cd /data/data/com.termux/files/home/OzvyX-AI
export OPENBLAS_NUM_THREADS=1
export OMP_NUM_THREADS=1
exec nice -n 19 python -u -m training.trainer
