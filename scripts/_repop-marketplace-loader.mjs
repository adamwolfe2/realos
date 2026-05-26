// Loader that stubs server-only for the repop script.
export async function resolve(specifier, ctx, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export default {};", shortCircuit: true, format: "module" };
  }
  return next(specifier, ctx);
}
