#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <time.h>

typedef struct {
    int dim; int hidden_dim; int n_layers; int n_heads; int seq_len; int vocab_size;
} Config;

typedef struct {
    float* token_embedding_table; float* wpe;
    float* ln1_w; float* ln1_b; float* wq; float* wk; float* wv; float* wo;
    float* ln2_w; float* ln2_b; float* w1; float* b1; float* w2; float* b2;
    float* lnf_w; float* lnf_b; float* head;
} Weights;

typedef struct {
    float *x, *xb, *xb2, *hb, *hb2, *q, *k, *v, *att, *logits;
    float *key_cache, *value_cache;
} RunState;

void malloc_weights(Weights* w, Config* p) {
    int dim = p->dim, hid = p->hidden_dim, L = p->n_layers;
    w->token_embedding_table = malloc(p->vocab_size * dim * sizeof(float));
    w->wpe = malloc(p->seq_len * dim * sizeof(float));
    w->ln1_w = malloc(L * dim * sizeof(float)); w->ln1_b = malloc(L * dim * sizeof(float));
    w->wq = malloc(L * dim * dim * sizeof(float)); w->wk = malloc(L * dim * dim * sizeof(float));
    w->wv = malloc(L * dim * dim * sizeof(float)); w->wo = malloc(L * dim * dim * sizeof(float));
    w->ln2_w = malloc(L * dim * sizeof(float)); w->ln2_b = malloc(L * dim * sizeof(float));
    w->w1 = malloc(L * hid * dim * sizeof(float)); w->b1 = malloc(L * hid * sizeof(float));
    w->w2 = malloc(L * dim * hid * sizeof(float)); w->b2 = malloc(L * dim * sizeof(float));
    w->lnf_w = malloc(dim * sizeof(float)); w->lnf_b = malloc(dim * sizeof(float));
    w->head = malloc(p->vocab_size * dim * sizeof(float));
}

void load_weights(Weights* w, Config* p, const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) { printf("Ошибка: не могу открыть %s\n", path); exit(1); }
    fread(w->token_embedding_table, sizeof(float), p->vocab_size * p->dim, f);
    fread(w->wpe, sizeof(float), p->seq_len * p->dim, f);
    for (int l = 0; l < p->n_layers; l++) {
        fread(w->ln1_w + l*p->dim, sizeof(float), p->dim, f);
        fread(w->ln1_b + l*p->dim, sizeof(float), p->dim, f);
        fread(w->wq + l*p->dim*p->dim, sizeof(float), p->dim*p->dim, f);
        fread(w->wk + l*p->dim*p->dim, sizeof(float), p->dim*p->dim, f);
        fread(w->wv + l*p->dim*p->dim, sizeof(float), p->dim*p->dim, f);
        fread(w->wo + l*p->dim*p->dim, sizeof(float), p->dim*p->dim, f);
        fread(w->ln2_w + l*p->dim, sizeof(float), p->dim, f);
        fread(w->ln2_b + l*p->dim, sizeof(float), p->dim, f);
        fread(w->w1 + l*p->hidden_dim*p->dim, sizeof(float), p->hidden_dim*p->dim, f);
        fread(w->b1 + l*p->hidden_dim, sizeof(float), p->hidden_dim, f);
        fread(w->w2 + l*p->dim*p->hidden_dim, sizeof(float), p->dim*p->hidden_dim, f);
        fread(w->b2 + l*p->dim, sizeof(float), p->dim, f);
    }
    fread(w->lnf_w, sizeof(float), p->dim, f);
    fread(w->lnf_b, sizeof(float), p->dim, f);
    fread(w->head, sizeof(float), p->vocab_size * p->dim, f);
    fclose(f);
}

void layernorm(float* out, float* x, float* weight, float* bias, int size) {
    float mean = 0.0f, var = 0.0f;
    for (int i = 0; i < size; i++) mean += x[i];
    mean /= size;
    for (int i = 0; i < size; i++) var += (x[i] - mean) * (x[i] - mean);
    var /= size;
    float inv_std = 1.0f / sqrtf(var + 1e-5f);
    for (int i = 0; i < size; i++) out[i] = (x[i] - mean) * inv_std * weight[i] + bias[i];
}

void matmul(float* out, float* x, float* w, int n, int d) {
    for (int i = 0; i < d; i++) {
        float val = 0.0f;
        for (int j = 0; j < n; j++) val += w[i * n + j] * x[j];
        out[i] = val;
    }
}

void softmax(float* x, int size) {
    float max_val = x[0];
    for (int i = 1; i < size; i++) if (x[i] > max_val) max_val = x[i];
    float sum = 0.0f;
    for (int i = 0; i < size; i++) { x[i] = expf(x[i] - max_val); sum += x[i]; }
    for (int i = 0; i < size; i++) x[i] /= sum;
}

int sample(float* logits, int vocab_size, float temp) {
    for (int i = 0; i < vocab_size; i++) logits[i] /= temp;
    softmax(logits, vocab_size);
    float r = (float)rand() / RAND_MAX;
    float cdf = 0.0f;
    for (int i = 0; i < vocab_size; i++) {
        cdf += logits[i];
        if (r < cdf) return i;
    }
    return vocab_size - 1;
}

void forward(Weights* w, RunState* s, Config* p, int token, int pos) {
    int dim = p->dim, hid = p->hidden_dim, L = p->n_layers, nh = p->n_heads;
    int hd = dim / nh;
    for (int i = 0; i < dim; i++) s->x[i] = w->token_embedding_table[token * dim + i] + w->wpe[pos * dim + i];
    for (int l = 0; l < L; l++) {
        layernorm(s->xb, s->x, w->ln1_w + l*dim, w->ln1_b + l*dim, dim);
        matmul(s->q, s->xb, w->wq + l*dim*dim, dim, dim);
        matmul(s->k, s->xb, w->wk + l*dim*dim, dim, dim);
        matmul(s->v, s->xb, w->wv + l*dim*dim, dim, dim);
        for (int i = 0; i < dim; i++) {
            s->key_cache[l * p->seq_len * dim + pos * dim + i] = s->k[i];
            s->value_cache[l * p->seq_len * dim + pos * dim + i] = s->v[i];
        }
        for (int h = 0; h < nh; h++) {
            float* qh = s->q + h * hd;
            float* att_h = s->att + h * p->seq_len;
            for (int t = 0; t <= pos; t++) {
                float* kh = s->key_cache + l * p->seq_len * dim + t * dim + h * hd;
                float score = 0.0f;
                for (int i = 0; i < hd; i++) score += qh[i] * kh[i];
                att_h[t] = score / sqrtf(hd);
            }
            softmax(att_h, pos + 1);
            float* xb_h = s->xb2 + h * hd;
            for (int i = 0; i < hd; i++) xb_h[i] = 0.0f;
            for (int t = 0; t <= pos; t++) {
                float* vh = s->value_cache + l * p->seq_len * dim + t * dim + h * hd;
                for (int i = 0; i < hd; i++) xb_h[i] += att_h[t] * vh[i];
            }
        }
        matmul(s->xb, s->xb2, w->wo + l*dim*dim, dim, dim);
        for (int i = 0; i < dim; i++) s->x[i] += s->xb[i];
        layernorm(s->xb, s->x, w->ln2_w + l*dim, w->ln2_b + l*dim, dim);
        matmul(s->hb, s->xb, w->w1 + l*hid*dim, dim, hid);
        for (int i = 0; i < hid; i++) {
            float val = s->hb[i];
            s->hb[i] = 0.5f * val * (1.0f + tanhf(0.7978845608f * (val + 0.044715f * val * val * val))) + w->b1[l*hid + i];
        }
        matmul(s->hb2, s->hb, w->w2 + l*dim*hid, hid, dim);
        for (int i = 0; i < dim; i++) s->x[i] += s->hb2[i] + w->b2[l*dim + i];
    }
    layernorm(s->xb, s->x, w->lnf_w, w->lnf_b, dim);
    matmul(s->logits, s->xb, w->head, dim, p->vocab_size);
}

int main(int argc, char *argv[]) {
    Config config = {512, 2048, 12, 8, 128, 4000};
    Weights weights;
    malloc_weights(&weights, &config);
    load_weights(&weights, &config, "checkpoints/model.bin");
    
    RunState state;
    int dim = config.dim, hid = config.hidden_dim, seq = config.seq_len;
    state.x = malloc(dim * sizeof(float)); state.xb = malloc(dim * sizeof(float));
    state.xb2 = malloc(dim * sizeof(float)); state.hb = malloc(hid * sizeof(float));
    state.hb2 = malloc(dim * sizeof(float)); state.q = malloc(dim * sizeof(float));
    state.k = malloc(dim * sizeof(float)); state.v = malloc(dim * sizeof(float));
    state.att = malloc(config.n_heads * seq * sizeof(float));
    state.logits = malloc(config.vocab_size * sizeof(float));
    state.key_cache = malloc(config.n_layers * seq * dim * sizeof(float));
    state.value_cache = malloc(config.n_layers * seq * dim * sizeof(float));
    
    srand(time(NULL));

    int prompt_ids[100];
    int prompt_len = 0;

    if (argc > 1) {
        char *token = strtok(argv[1], ",");
        while (token != NULL && prompt_len < 100) {
            prompt_ids[prompt_len++] = atoi(token);
            token = strtok(NULL, ",");
        }
    } else {
        prompt_ids[0] = 100;
        prompt_len = 1;
    }

    for (int pos = 0; pos < prompt_len; pos++) {
        forward(&weights, &state, &config, prompt_ids[pos], pos);
    }

    int current_pos = prompt_len;
    int token = prompt_ids[prompt_len - 1];

    for (int i = 0; i < 30; i++) {
        token = sample(state.logits, config.vocab_size, 0.8f);
        printf("%d,", token);
        fflush(stdout);
        
        if (current_pos < config.seq_len) {
            forward(&weights, &state, &config, token, current_pos);
            current_pos++;
        }
    }
    printf("\n");
    return 0;
}
