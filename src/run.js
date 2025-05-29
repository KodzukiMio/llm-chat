(function () {
    let style = document.createElement('style');
    document.head.appendChild(style);
    style.sheet.insertRule(`
      @keyframes anim-line {
        from {
            background-color: rgba(142, 142, 142, 1);
        }
        to {
            background-color: rgba(142, 142, 142, 0);
        }
    }`, style.sheet.cssRules.length);
})();
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "./gemini.mjs";
export class LocalStorageManager {
    constructor(namespace = 'app') {
        this.namespace = namespace;
    }
    save(key, value) {
        if (typeof key !== 'string') throw new Error('Key must be a string.');
        let stringifiedValue;
        try {
            stringifiedValue = JSON.stringify(value);
        } catch (error) {
            throw new Error(`Value could not be stringified: ${error.message}`);
        }
        localStorage.setItem(`${this.namespace}-${key}`, stringifiedValue);
    }
    read(key, defaultValue = null) {
        if (typeof key !== 'string') throw new Error('Key must be a string.');
        const value = localStorage.getItem(`${this.namespace}-${key}`);
        if (value === null) return defaultValue;
        try {
            return JSON.parse(value);
        } catch (error) {
            console.error(`Error parsing JSON for key "${key}":`, error);
            return null;
        }
    }
    remove(key) {
        if (typeof key !== 'string') {
            throw new Error('Key must be a string.');
        }
        localStorage.removeItem(`${this.namespace}-${key}`);
    }
    clear() {
        for (let key in localStorage) {
            if (key.startsWith(`${this.namespace}-`)) {
                localStorage.removeItem(key);
            }
        }
    }
}
const SafeSetting = Object.values(HarmCategory).map((category) => ({
    category,
    threshold: HarmBlockThreshold.BLOCK_NONE,
}));
import { Ollama } from 'ollama/browser'
import Openai from 'openai'
function createOllama(url = "http://127.0.0.1:11434") {
    return new Ollama({ host: url });
}
function createDeepSeek(url, key) {
    return new Openai({ baseURL: url, apiKey: key, dangerouslyAllowBrowser: true });
}
export const model_type = {
    gemini: 1,
    deepseek: 2,
    local: 3,
    other_ds: 4,
    ohmygpt: 5,
    aliyun: 6,
    openrouter: 7,
    custom: 8,
};
export class GenText {
    constructor(toId, space = 10, initial = true) {
        this.toId = toId;
        this.text_node = null;
        this.speed = space;
        this.line = null;
        this.think_node = null;
        this.callback = null;
        if (initial) this.init();
    }
    async sleep(delay) {
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
    setCallBack(pfn) {
        this.callback = pfn;
    }
    createLine() {
        let elm = document.createElement("span");
        elm.innerHTML = "&thinsp;";
        elm.style.backgroundColor = "rgba(142, 142, 142,1)";
        elm.style.animation = "anim-line 0.5s ease-in-out infinite alternate";
        elm.style.fontSize = "15px";
        elm.style.color = "white";
        return elm;
    }
    init() {
        this.text_node = document.createElement("span");
        this.think_node = document.createElement("think");
        //this.text_node.contentEditable = "true";
        document.getElementById(this.toId).appendChild(this.think_node);
        document.getElementById(this.toId).appendChild(document.createElement("br"));
        document.getElementById(this.toId).appendChild(this.text_node);
        this.line = this.createLine();
        this.line.hidden = true;
        document.getElementById(this.toId).appendChild(this.line);
        this.clear();
    }
    appendTextNoDelay(text) {
        this.text_node.innerText += text;
    }
    async appendText(text, clear = false) {
        if (clear) this.text_node.innerText = "";
        for (let i = 0; i < text.length; i++) {
            this.text_node.innerText += text[i];
            if (this.speed) await this.sleep(this.speed);
        }
    }
    async appendThinkText(text, clear = false) {
        if (clear) this.think_node.innerText = "";
        for (let i = 0; i < text.length; i++) {
            this.think_node.innerText += text[i];
            if (this.speed) await this.sleep(this.speed);
        }
    }
    clear() {
        this.text_node.innerText = "";
        if (this.think_node) this.think_node.innerText = "";
    }
    finish() {
        this.line.hidden = true;
        if (this.callback) this.callback(this);
    }
    show() {
        this.line.hidden = false;
    }
}
export class GenAI {
    constructor(model_name = "gemini-1.5-pro", type = model_type.gemini, key = [], sys_msg = "") {
        this.name = model_name;
        this.key = key;
        this.type = type;
        this.models = [];
        this.itr = 0;
        this.limit = 0;
        this.num_ctx = 4096;
        this.history = [];
        this.system = sys_msg;
        this.local_url = `http://${window.location.hostname}:11434`;
        this.deepseek_url = "https://api.deepseek.com";
        this.other_url = "https://api.siliconflow.cn/v1";
        this.ohmygpt_url = "https://api.ohmygpt.com";
        this.aliyun_url = "https://dashscope.aliyuncs.com/compatible-mode/v1";
        this.openrouter_url = "https://openrouter.ai/api/v1";
        this.custom_url = "";
        this._input = null;
        this._proxy = null;
        this._callback = null;
        this._err_callback = null;
        this.max_out_token = 8192;
        this.param = [0.9, 0.95, 16];//temperature,top p,top k;
        if (!key) throw new Error("require key !");
        this.init();
    }
    autoNumCtx(numctx = 4096) {
        if (this.type == model_type.local) {
            this.num_ctx = numctx;
        }
    }
    clear() {
        this.history = [];
        this._proxy = null;
        this._input = null;
    }
    setModel(model_name, type) {
        this.name = model_name;
        this.type = type;
        this.setSystemMessage("");
    }
    setParameters(temperature = 0.9, topP = 0.95, topK = 16) {
        this.param = [temperature, topP, topK];
    }
    setLimit(value) {
        this.limit = value;
    }
    roll() {
        return this.itr = (this.itr + 1) % this.models.length;
    }
    createMessage(role_type, msg) {//"user","model"
        if (this.type != model_type.gemini && role_type == "model") {
            if (msg.startsWith("<think>")) msg = msg.substring(msg.lastIndexOf("</think>") + 10);//\n\n
        }
        return { role: role_type, parts: [{ text: msg }] };
    }
    convertFormat(msg) {
        return { role: msg.role == "model" ? "assistant" : "user", content: msg.parts[0].text };
    }
    setCallBack(callback_, errback_) {
        this._callback = callback_;
        this._err_callback = errback_;
    }
    setSystemMessage(text) {
        this.system = text;
        this.models = [];
        this.init();
    }
    getRollModel() {
        return this.models[this.roll()];
    }
    init() {
        if (this.type == model_type.local) {
            this.models.push(createOllama(this.local_url));
        } else if (this.type == model_type.deepseek) {
            for (let i = 0; i < this.key.length; i++) {
                if (this.key[i].startsWith("sk-")) {
                    this.models.push(createDeepSeek(this.deepseek_url, this.key[i]));
                };
            }
        } else if (this.type == model_type.other_ds) {
            for (let i = 0; i < this.key.length; i++) {
                if (this.key[i].startsWith("!sk-")) {//第三方用!开头
                    this.models.push(createDeepSeek(this.other_url, this.key[i].substring(1)));
                }
            }
        } else if (this.type == model_type.ohmygpt) {
            for (let i = 0; i < this.key.length; i++) {
                if (this.key[i].startsWith("#sk-")) {//ohmygpt
                    this.models.push(createDeepSeek(this.ohmygpt_url, this.key[i].substring(1)));
                }
            }
        } else if (this.type == model_type.aliyun) {
            for (let i = 0; i < this.key.length; i++) {
                if (this.key[i].startsWith("$sk-")) {//阿里云
                    this.models.push(createDeepSeek(this.aliyun_url, this.key[i].substring(1)));
                }
            }
        } else if (this.type == model_type.openrouter) {
            for (let i = 0; i < this.key.length; i++) {
                if (this.key[i].startsWith("sk-or")) {//openrouter
                    this.models.push(createDeepSeek(this.openrouter_url, this.key[i]));
                }
            }
        } else if (this.type == model_type.custom) {
            for (let i = 0; i < this.key.length; i++) {
                if (this.key[i].startsWith("@sk")) {//custom
                    this.models.push(createDeepSeek(this.custom_url, this.key[i].substring(1)));
                }
            }
        } else {
            for (let i = 0; i < this.key.length; ++i) {
                if (!this.key[i].startsWith("sk-") && !this.key[i].startsWith("!sk-")) {
                    this.models.push((new GoogleGenerativeAI(this.key[i])).getGenerativeModel({ model: this.name, SafeSetting, systemInstruction: this.system }));
                }
            }
        }
    }
    setInput(text) {
        this._input = text;
    }
    edit(history_index = null, new_text = null, role = null) {//null -> default
        if (history_index && history_index >= 0) {
            if (new_text) this.history[history_index].parts[0].text = new_text;
            if (role) this.history[history_index].role = role;
        }
    }
    applyTextChange(proxy, index) {
        this.history[index].parts[0].text = proxy.text_node.innerText;
    }
    popMessage() {
        return this.history.pop();
    }
    addMessage(role_type, message) {
        this.history.push(this.createMessage(role_type, message));
    }
    removeMessage(index = -1, count = 1) {
        if (index >= 0) this.history.splice(index, count);
        else this.history.splice(this.history.length + index, count);
    }
    async reSubmit(proxy = null, first_user = false) {
        if (!this._input || !this._proxy && !proxy) throw new Error("Submit at least once.");
        if (!first_user) this.popMessage();
        this.popMessage();
        return await this.submit(proxy || this._proxy);
    }
    async proxyHandle(chunkText, reasoning_content = "") {
        if (this._proxy) {
            await this._proxy.appendThinkText(reasoning_content);
            await this._proxy.appendText(chunkText);
        }
        else console.log(chunkText, reasoning_content);
        if (this._callback) this._callback(this);
    }
    check_model() {
        if (this.models.length == 0) throw new Error("缺失的APIKEY.");
    }
    async submit(proxy_gentext_object, only_model = false) {
        this.autoNumCtx();
        let _history = this.history.slice();//浅拷贝
        if (this.limit > 0 && this.history.length > this.limit) _history = this.history.slice(this.history.length - this.limit, this.history.length);
        if (this.type != model_type.gemini) {
            let local_history = [];
            // if (this.name.indexOf("gemma") != -1) local_history.push({ role: "assistant", content: this.system });
            // else
            local_history.push({ role: "system", content: this.system });
            for (let i = 0; i < _history.length; i++) {
                local_history.push(this.convertFormat(_history[i]));
            }
            local_history.push({ role: "user", content: this._input });
            _history = local_history;
        }
        this._proxy = proxy_gentext_object;
        if (this._proxy) this._proxy.show();
        let model = null;
        let has_push = false;
        try {
            this.check_model();
            let text = '';
            if (this.type == model_type.local) {
                model = this.models[0];
                const stream = await model.chat({
                    model: this.name,
                    messages: _history,
                    stream: true,
                    options: {
                        temperature: this.param[0],
                        top_p: this.param[1],
                        top_k: this.param[2],
                        num_ctx: this.num_ctx,
                    }
                });
                for await (const chunk of stream) {
                    let content = chunk.message.content;
                    await this.proxyHandle(content);
                    text += content;
                }
            } else if (this.type == model_type.deepseek || this.type == model_type.other_ds || this.type == model_type.ohmygpt || this.type == model_type.aliyun || this.type == model_type.openrouter) {
                model = this.getRollModel();
                const stream = await model.chat.completions.create({
                    model: this.name,
                    messages: _history,
                    stream: true,
                    temperature: this.param[0],
                    top_p: this.param[1],
                    top_k: this.param[2],
                });
                for await (const chunk of stream) {
                    let reasoning_content = chunk.choices[0]?.delta?.reasoning_content || '';
                    let content = chunk.choices[0]?.delta?.content || '';
                    await this.proxyHandle(content, reasoning_content);
                    text += content;
                }
            } else {
                model = this.getRollModel();
                const chat = model.startChat({//太恶毒了,会偷偷修改_history,所以用slice
                    history: _history,
                    generationConfig: {
                        maxOutputTokens: this.max_out_token,
                        temperature: this.param[0],
                        topP: this.param[1],
                        topK: this.param[2],
                    },
                });
                const result = await chat.sendMessageStream(this._input);
                for await (const chunk of result.stream) {
                    let content = chunk.text();
                    await this.proxyHandle(content);
                    text += content;
                }
            }
            if (!only_model) {
                has_push = true;
                this.history.push(this.createMessage("user", this._input));
            }
            this.history.push(this.createMessage("model", text));
        } catch (e) {
            if (!has_push) this.history.push(this.createMessage("user", this._input));
            if (this._err_callback) this._err_callback(this);
            console.log(model);
            if (window.showError) window.showError(e);

        }
        if (this._proxy) this._proxy.finish();
        return true;
    }
    setProxy(proxy) {
        this._proxy = proxy;
    }
    async postMessage(text, proxy = null) {
        if (proxy) this._proxy = proxy;
        if (!this._proxy) return false;
        this.setInput(text);
        return await this.submit(this._proxy);
    }
}
export function createAI(model_name = "gemini-1.5-flash", type = model_type.gemini, key = [], sys_msg = "") {
    return new GenAI(model_name, type, key, sys_msg);
}
//example
// let ai = createAI("gemini-1.5-flash",model_type.gemini,["API_KEY"])
// ai.setProxy(new GenText("chat"));
// ai.postMessage("Hello, world!");