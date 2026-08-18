async function main(): Promise<void> {
  const urls = [
    "http://127.0.0.1:8800/paid/weather?city=Paris",
    "http://127.0.0.1:8801/paid/weather?city=London",
  ];
  for (const url of urls) {
    const res = await fetch(url);
    console.log("\n===", url, "===");
    console.log("status", res.status);
    const text = await res.text();
    console.log("body", text.slice(0, 500));
    for (const [k, v] of res.headers) {
      if (
        k.includes("payment") ||
        k.includes("x402") ||
        k.startsWith("x-")
      ) {
        console.log(k, v.slice(0, 200));
      }
    }
  }
}

main().catch(console.error);
