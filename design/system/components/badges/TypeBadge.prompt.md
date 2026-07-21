Small mono uppercase badge marking a parsed line's type in the sequence editor.

```jsx
<TypeBadge kind="call" />
<TypeBadge kind="warning" />
```

Six kinds: `call` (a choreo step) plus the presentation text types `activator`, `filler`, `tip`, `warning`, `recovery`. Each has its own paired fg/bg token, so it stays legible in both themes.
