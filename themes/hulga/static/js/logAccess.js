// 记录访问
async function logAccess(url) {
    try {
        const response = await fetch(
            "https://blog.iselt.top/api/v1/log-access",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    url: url,
                }),
            }
        );

        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await response.text();
        return data;
    } catch (error) {
        console.error("Error logging access:", error);
        throw error;
    }
}

logAccess(window.location.href);
