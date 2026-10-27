import os
import sys
import numpy as np
from config.settings import SETTINGS
from model.transformer import OzvyxSmall
from model.bpe_tokenizer import BPETokenizer
from model.layers import softmax

def generate_streaming(model, tokenizer, prompt, max_new_tokens=60, temperature=0.8, top_k=40):
    rng = np.random.default_rng()
    prompt_ids = tokenizer.encode(prompt)
    if not prompt_ids:
        prompt_ids = [0]
        
    seq = np.array([prompt_ids])
    bs = model.block_size
    
    generated = list(prompt_ids)
    print("OzvyX: ", end="", flush=True)
    
    for _ in range(max_new_tokens):
        ctx = seq[:, -bs:]
        logits, _, _ = model.forward(ctx)
        next_logits = logits[0, -1, :] / max(temperature, 1e-6)

        if top_k > 0:
            kth = np.partition(next_logits, -top_k)[-top_k]
            next_logits = np.where(next_logits < kth, -np.inf, next_logits)

        probs = softmax(next_logits)
        nxt = int(rng.choice(probs.shape[0], p=probs))
        
        seq = np.concatenate([seq, np.array([[nxt]])], axis=1)
        generated.append(nxt)
        
        # Печатаем только новый токен
        new_word = tokenizer.vocab.get(nxt, "")
        print(new_word + " ", end="", flush=True)
        
    print("\n")

def main() -> int:
    print(f"Загрузка модели: {SETTINGS.checkpoint_path}")
    model = OzvyxSmall.load(SETTINGS.checkpoint_path)
    tokenizer = BPETokenizer.load("checkpoints/dict_v2.json")

    print(f"OzvyX-small готов. Параметров: {sum(p.size for p in model.params.values()):,}\n")
    print("Команды: /exit — выход\n")

    while True:
        try:
            user = input("Вы: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not user or user.lower() == "/exit":
            break
            
        try:
            generate_streaming(model, tokenizer, user, max_new_tokens=40)
        except KeyboardInterrupt:
            print("\n[прервано]\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
