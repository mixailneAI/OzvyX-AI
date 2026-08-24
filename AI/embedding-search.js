// AI/embedding-search.js
import { pipeline } from '@xenova/transformers';

// Функция для косинусного сходства
function cosineSimilarity(vecA, vecB) {
    const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dot / (normA * normB + 1e-8);
}

class EmbeddingSearch {
    constructor() {
        this.model = null;
        this.embeddings = null;
        this.items = [];
        this.ready = false;
    }

    async init(knowledge) {
        this.items = Object.entries(knowledge);
        if (this.items.length === 0) {
            console.warn('База знаний пуста');
            return;
        }

        console.log('🔄 Загрузка модели для эмбеддингов...');
        this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ Модель загружена');

        const questions = this.items.map(([q]) => q);
        console.log(`📚 Создаю эмбеддинги для ${questions.length} вопросов...`);
        const embeddings = await this.model(questions, { pooling: 'mean', normalize: true });
        this.embeddings = embeddings.tolist();
        this.ready = true;
        console.log('✅ Индекс готов');
    }

    async search(query, topK = 1) {
        if (!this.ready) {
            return { answer: 'Модель ещё не загружена, попробуйте позже.', confidence: 0 };
        }

        const queryVector = await this.model(query, { pooling: 'mean', normalize: true });
        const qVec = queryVector.tolist()[0];

        const scores = this.embeddings.map((vec, i) => ({
            index: i,
            score: cosineSimilarity(qVec, vec),
            question: this.items[i][0],
            answer: this.items[i][1]
        }));

        scores.sort((a, b) => b.score - a.score);
        const top = scores.slice(0, topK);

        if (top[0].score < 0.3) {
            return {
                answer: 'Не нашёл подходящего ответа в базе. Можешь переформулировать?',
                confidence: top[0].score,
                alternatives: top
            };
        }

        return {
            answer: top[0].answer,
            confidence: top[0].score,
            alternatives: top.slice(1)
        };
    }
}

export const embeddingSearch = new EmbeddingSearch();