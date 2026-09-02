import tseslint from "typescript-eslint"

export default tseslint.config({
  files: ["{app,auth,landing,library,profiles,results,sources}/**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser },
  plugins: { "@typescript-eslint": tseslint.plugin },
  rules: {
    "@typescript-eslint/naming-convention": [
      "error",
      { selector: "import", format: null },
      { selector: "objectLiteralProperty", format: null },
      { selector: "typeProperty", format: null },
      { selector: "typeLike", format: ["PascalCase"] },
      { selector: "variableLike", format: ["PascalCase"] }
    ]
  }
})
