```markdown
# margel360-nov Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides a comprehensive guide to the development patterns used in the `margel360-nov` JavaScript repository. It covers coding conventions, commit practices, and common workflows such as updating security headers and internationalizing pages. The guide is designed to help contributors maintain consistency and quality across the codebase.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `translationsEdit.js`, `userProfile.js`

### Import Style
- Use **relative imports** for modules.
  ```js
  import { translate } from './translationsEdit.js';
  ```

### Export Style
- Use **named exports**.
  ```js
  // In translationsEdit.js
  export function translate(key) { ... }
  ```

### Commit Messages
- Follow **conventional commit** patterns.
  - Prefixes: `fix`, `feat`, `security`
  - Example:  
    ```
    feat: add Spanish translations to reservation page
    ```

## Workflows

### Security Header Policy Update
**Trigger:** When someone wants to improve or audit site security by changing HTTP headers or related config.  
**Command:** `/update-security-headers`

1. Edit `netlify.toml` to adjust security headers (e.g., CSP, COOP, CORP, SRI).
   ```toml
   [[headers]]
   for = "/*"
   [headers.values]
     Content-Security-Policy = "default-src 'self';"
     Cross-Origin-Opener-Policy = "same-origin"
   ```
2. Document the rationale and risk in the commit message.
   ```
   security: tighten CSP to disallow inline scripts
   ```
3. Verify that changes do not break existing site functionality by testing the deployed site.

---

### Internationalization of Existing Page
**Trigger:** When someone wants to make a previously single-language page support multiple languages.  
**Command:** `/i18n-page`

1. Add or update the relevant translations JS file (e.g., `translationsEdit.js`, `translationsReservation.js`).
   ```js
   // translationsEdit.js
   export const translations = {
     en: { save: "Save" },
     es: { save: "Guardar" }
   };
   ```
2. Update the HTML file to use `data-i18n` attributes for all static and dynamic text.
   ```html
   <button data-i18n="save"></button>
   ```
3. Update the relevant JS logic to wire up the i18n engine and handle language toggling.
   ```js
   import { translations } from './translationsEdit.js';
   function setLanguage(lang) {
     document.querySelectorAll('[data-i18n]').forEach(el => {
       const key = el.getAttribute('data-i18n');
       el.textContent = translations[lang][key];
     });
   }
   ```
4. Bump version numbers for cache busting if needed.

## Testing Patterns

- Test files follow the pattern `*.test.*`.
  - Example: `translationsEdit.test.js`
- The testing framework is **unknown**, but tests are colocated with source files or in the same directory.
- Example test file structure:
  ```js
  // translationsEdit.test.js
  import { translate } from './translationsEdit.js';

  test('translates save to Spanish', () => {
    expect(translate('save', 'es')).toBe('Guardar');
  });
  ```

## Commands

| Command                  | Purpose                                                        |
|--------------------------|----------------------------------------------------------------|
| /update-security-headers | Update or audit HTTP security headers in `netlify.toml`.       |
| /i18n-page               | Add or improve internationalization support for a web page.    |
```