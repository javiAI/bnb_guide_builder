export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    if (warning.name === "NodeDeprecationWarning" && /aws-sdk/i.test(warning.message)) {
      return;
    }
    console.warn(warning);
  });
}
