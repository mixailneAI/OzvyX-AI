"""Подробный цикл обучения с частым автосохранением."""
import time
import os
import numpy as np
from config.settings import SETTINGS
from model.transformer import OzvyxSmall, Adam
from model.tokenizer import CharTokenizer
from training.dataset import get_batch

def main():
    s = SETTINGS
    with open(s.data_path, encoding="utf-8") as f:
        text = f.read()

    # Проверяем, есть ли сохраненный чекпоинт.
    if os.path.exists(s.checkpoint_path) and os.path.exists(s.tokenizer_path):
        print("Найден чекпоинт. Продолжаем обучение...", flush=True)
        model = OzvyxSmall.load(s.checkpoint_path)
        tok = CharTokenizer.load(s.tokenizer_path)
    else:
        print("Чекпоинт не найден. Начинаем с нуля...", flush=True)
        tok = CharTokenizer(text)
        model = OzvyxSmall(tok.vocab_size, s.block_size, s.n_layer,
                           s.n_head, s.n_embd, seed=0)

    data = tok.encode(text)
    n = int(s.train_split * len(data))
    train_data, val_data = data[:n], data[n:]

    n_params = sum(p.size for p in model.params.values())
    print(f"=== START ===", flush=True)
    print(f"params={n_params:,}  vocab={tok.vocab_size}  batch={s.batch_size}  iters={s.iterations}", flush=True)

    opt = Adam(model.params, lr=s.learning_rate)
    rng = np.random.default_rng(0)
    t0 = time.time()

    for step in range(1, s.iterations + 1):
        xb, yb = get_batch(train_data, s.block_size, s.batch_size, rng=rng)
        _, loss, cache = model.forward(xb, yb)
        grads = model.backward(cache)
        opt.step(grads)

        elapsed = time.time() - t0
        sps = step / elapsed if elapsed > 0 else 0.0
        eta_min = (s.iterations - step) / sps / 60 if sps > 0 else 0.0

        val_str = ""
        if step % 100 == 0 or step == s.iterations:
            vals = []
            for _ in range(5):
                xv, yv = get_batch(val_data, s.block_size, s.batch_size, rng=rng)
                _, vl, _ = model.forward(xv, yv)
                vals.append(vl)
            val_str = f"  val={np.mean(vals):.4f}"

        print(f"step {step:5d}/{s.iterations}  train={loss:.4f}{val_str}  sps={sps:.2f}  eta={eta_min:.1f}m", flush=True)

        # АВТОСОХРАНЕНИЕ КАЖДЫЕ 10 ШАГОВ (теперь можно прерывать в любой момент)
        if step % 10 == 0:
            model.save(s.checkpoint_path)
            tok.save(s.tokenizer_path)
            print(f"--- Чекпоинт сохранен на шаге {step} ---", flush=True)

    model.save(s.checkpoint_path)
    tok.save(s.tokenizer_path)
    print(f"=== DONE: {s.checkpoint_path} ===", flush=True)

if __name__ == "__main__":
    main()
