import subprocess
from model.bpe_tokenizer import BPETokenizer

print("Загрузка токенизатора...")
tok = BPETokenizer.load('checkpoints/tokenizer.json')

print("OzvyX запущен! (Напиши 'exit' для выхода)\n")
while True:
    user_input = input("Вы: ")
    if user_input.lower() == 'exit':
        break
    if not user_input:
        continue

    # Переводим текст в ID
    prompt_ids = tok.encode(user_input)
    prompt_str = ",".join(map(str, prompt_ids))

    # Вызываем C-движок
    result = subprocess.run(['./engine', prompt_str], capture_output=True, text=True)
    
    if result.returncode != 0:
        print("Ошибка C-движка:", result.stderr)
        continue

    # Читаем ответные ID
    out_ids_str = result.stdout.strip()
    if not out_ids_str:
        print("Пустой ответ от движка.")
        continue
        
    generated_ids = [int(x) for x in out_ids_str.split(",") if x]
    
    # Переводим ID обратно в текст
    answer = tok.decode(generated_ids)
    print(f"OzvyX: {answer}\n")
