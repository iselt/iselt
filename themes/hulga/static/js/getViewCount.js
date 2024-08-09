// 获取当前 URL 浏览次数
async function getViewCount(url) {
    try {
        const response = await fetch(
            `https://blog.iselt.top/api/v1/view-count?url=${encodeURIComponent(
                url
            )}`
        );

        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching view count:", error);
        throw error;
    }
}

// 获取当前 URL 并去除 # 及其后面的内容
const currentUrl = window.location.href.split("#")[0];

getViewCount(currentUrl).then((data) => {
    const count = data.count;
    const countElement = document.getElementById("view-count");
    if (countElement) {
        countElement.textContent = count;
    }
});
