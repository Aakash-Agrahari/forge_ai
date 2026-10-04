import {
    detectLanguageFromFile,
    detectProjectLanguages,
    detectPrimaryProjectLanguage
} from "./src/execution/languageDetector.js";

console.log(
    "Java:",
    detectLanguageFromFile(
        "src/Calculator.java"
    )
);

console.log(
    "Python:",
    detectLanguageFromFile(
        "src/calculator.py"
    )
);

console.log(
    "JavaScript:",
    detectLanguageFromFile(
        "src/app.js"
    )
);

console.log(
    "C++:",
    detectLanguageFromFile(
        "src/main.cpp"
    )
);

const files = [
    { path: "src/Calculator.java" },
    { path: "src/Main.java" },
    { path: "pom.xml" },
    { path: "README.md" }
];

console.log(
    "Project languages:",
    detectProjectLanguages(files)
);

console.log(
    "Primary project language:",
    detectPrimaryProjectLanguage(files)
);