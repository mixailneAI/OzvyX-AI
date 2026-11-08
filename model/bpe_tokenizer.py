import json
from collections import Counter

class BPETokenizer:
    def __init__(self, vocab=None, merges=None):
        self.vocab = vocab or {}
        self.merges = merges or {}
        self.inverse_vocab = {v: k for k, v in self.vocab.items()}
        self.merges_rank = {pair: rank for rank, pair in enumerate(self.merges.keys())}
        self.str_to_id = {v: k for k, v in self.vocab.items()}
        self.unk_id = self.str_to_id.get("<UNK>", 0)
        
    @classmethod
    def load(cls, path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if "model" in data and isinstance(data["model"], dict) and "vocab" in data["model"]:
            raw_vocab = data["model"]["vocab"]
            vocab = {v: k for k, v in raw_vocab.items()}
            merges = {}
            for m in data["model"].get("merges", []):
                a, b = (m.split(" ") if isinstance(m, str) else (m[0], m[1]))
                merged = a + b
                if merged in raw_vocab:
                    merges[(raw_vocab[a], raw_vocab[b])] = raw_vocab[merged]
        elif "vocab" in data:
            vocab = {int(k): v for k, v in data["vocab"].items()}
            merges = {tuple(map(int, k.split(','))): v for k, v in data.get("merges", {}).items()}
        elif "chars" in data:
            raise ValueError("⚠️ ОШИБКА: Это СТАРЫЙ файл токенизатора (на буквах)! Нужен новый BPE.")
        else:
            raise ValueError(f"❌ ОШИБКА: Неизвестный формат JSON. Ключи в файле: {list(data.keys())}")

        return cls(vocab, merges)

    def encode(self, text):
        words = text.split(" ")
        final_ids = []
        for word in words:
            tokens = [self.str_to_id.get(c, self.unk_id) for c in word]
            while len(tokens) >= 2:
                pairs = list(zip(tokens[:-1], tokens[1:]))
                pair = min(pairs, key=lambda p: self.merges_rank.get(p, float('inf')))
                if pair not in self.merges_rank:
                    break
                new_id = self.merges[pair]
                new_tokens = []
                i = 0
                while i < len(tokens):
                    if i < len(tokens) - 1 and (tokens[i], tokens[i+1]) == pair:
                        new_tokens.append(new_id)
                        i += 2
                    else:
                        new_tokens.append(tokens[i])
                        i += 1
                tokens = new_tokens
            final_ids.extend(tokens)
        return final_ids

    def decode(self, ids):
        result = ""
        punct = {".", ",", "!", "?", ";", ":", "-", ")", "»", "\""}
        for i in ids:
            word = self.vocab.get(i, "")
            if not word: continue
            if word in punct:
                result += word
            elif result and not result.endswith("\n"):
                result += " " + word
            else:
                result += word
        return result
