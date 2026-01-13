# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "Something went wrong" [level=1] [ref=e5]
  - paragraph [ref=e6]: RedByte OS encountered an unexpected error. You can try reloading the page, or perform a factory reset to clear all data and start fresh.
  - paragraph [ref=e8]: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
  - generic [ref=e9]:
    - button "Reload Page" [ref=e10] [cursor=pointer]
    - generic [ref=e11]:
      - paragraph [ref=e12]:
        - strong [ref=e13]: "Factory Reset (clears all data):"
      - list [ref=e14]:
        - listitem [ref=e15]: Reload the page
        - listitem [ref=e16]: Open Settings (Ctrl+,)
        - listitem [ref=e17]: Go to Filesystem Data
        - listitem [ref=e18]: Press F
        - listitem [ref=e19]:
          - text: Type
          - strong [ref=e20]: RESET
          - text: and confirm
  - paragraph [ref=e21]: If this problem persists, please report it on GitHub.
```