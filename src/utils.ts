// 等待某个元素加载完成
export function waitUntilElementReady(selector: string): Promise<Element> {
    return new Promise((resolve, reject) => {
        const maxTries = 100;
        let trys = 0;
        function _checkReady() {
            const el = document.querySelector(selector);
            if (el) {
                resolve(el);
                return;
            }
            if (trys++ > maxTries) {
                reject(new Error(`Element ${selector} not found after waiting.`));
                return;
            }
            setTimeout(_checkReady, 300);
        }
        _checkReady();
    })
};

// 将字符串转换为dom添加到元素前
export function insertHtmlBeforeElement(element: Element, html: string) {
    const range = document.createRange();
    const frag = range.createContextualFragment(html);
    element.parentElement?.insertBefore(frag, element);
}

// 打印日志
export function log(message: string) {
    console.log(`[B站治好了我的颈椎病] ${message}`);
}

// 风格化打印版本号
export function printVersion(version: string, cost: string) {
    console.log(
        `%c 🤪 B站治好了我的颈椎病 v${version} %c Cost ${cost}ms`,
        'background:#4A90E2;color:white;padding:2px 6px;border-radius:3px 0 0 3px;font-weight:bold;',
        'background:#50E3C2;color:#003333;padding:2px 6px;border-radius:0 3px 3px 0;font-weight:bold;',
    );
}
