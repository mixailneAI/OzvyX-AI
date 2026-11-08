import os
import sys
import subprocess
from model.bpe_tokenizer import BPETokenizer

def ensure_engine_compiled():
    source = "engine.c"
    binary = "engine"
    if not os.path.exists(source):
        print(f"❌ Ошибка: исходный файл {source} не найден!")
        sys.exit(1)
        
    need_compile = False
    if not os.path.exists(binary):
        need_compile = True
        print("⚙️  Движок не найден. Компилируем впервые...")
    elif os.path.getmtime(source) > os.path.getmtime(binary):
        need_compile = True
        print("⚙️  Исходный код engine.c был изменен. Перекомпилируем...")
        
    if need_compile:
        compilers = ["clang", "gcc", "cc"]
        compiled = False
        for compiler in compilers:
            try:
                subprocess.run([compiler, "--version"], capture_output=True, check=True)
                print(f"   Используем компилятор: {compiler}")
                cmd = [compiler, "-O3", "-o", binary, source, "-lm"]
                subprocess.run(cmd, check=True)
                compiled = True
                print("✅ Движок успешно скомпилирован!\n")
                break
            except FileNotFoundError:
                continue
            except subprocess.CalledProcessError as e:
                print(f"❌ Ошибка компиляции с помощью {compiler}:")
                sys.exit(1)
        if not compiled:
            print("❌ Не найден компилятор (clang, gcc или cc).")
            print("👉 Установите его в Termux командой: pkg install clang")
            sys.exit(1)
    if not os.access(binary, os.X_OK):
        os.chmod(binary, 0o755)

def main():
    ensure_engine_compiled()

    print("Загрузка токенизатора...")
    try:
        tok = BPETokenizer.load('OzvyX-base-model/tokenizer.json')
    except Exception as e:
        print(f"❌ Ошибка загрузки токенизатора: {e}")
        return

    print("OzvyX запущен! (Напиши 'exit' для выхода)\n")

    while True:
        try:
            user_input = input("Вы: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nДо встречи!")
            break
            
        if user_input.lower() in ('exit', '/exit', 'quit'):
            break
        if not user_input:
            continue

        # ВАЖНО: Формат, на котором мы обучали модель!
        prompt_text = f"Вопрос: {user_input}\nОтвет:"
        
        prompt_ids = tok.encode(prompt_text)
        prompt_str = ",".join(map(str, prompt_ids))

        try:
            # Таймаут 90 секунд, так как модель 250M может думать долго
            result = subprocess.run(['./engine', prompt_str], capture_output=True, text=True, timeout=90)
        except subprocess.TimeoutExpired:
            print("❌ Генерация заняла слишком много времени (таймаут).")
            continue
        
        if result.returncode != 0:
            print("❌ Ошибка C-движка:", result.stderr)
            continue

        out_ids_str = result.stdout.strip()
        if not out_ids_str:
            print("Пустой ответ от движка.")
            continue
            
        generated_ids = [int(x) for x in out_ids_str.split(",") if x]
        answer = tok.decode(generated_ids)
        
        # Обрезаем, если модель начала генерировать следующий вопрос
        answer = answer.split("Вопрос:")[0].strip()
        
        print(f"OzvyX: {answer}\n")

if __name__ == "__main__":
    main()
