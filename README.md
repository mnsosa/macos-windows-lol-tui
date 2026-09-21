# League of Legends keyboard setup for macOS

Use the physical `Ctrl` and `Alt` keys in League of Legends on macOS as you
would on Windows, without turning `Ctrl+Q` into the macOS **Quit** shortcut.

## Why this happens

League already supports the familiar Windows bindings on macOS:

| Action | Binding |
| --- | --- |
| Level an ability | `Ctrl+Q/W/E/R` |
| Self-cast an ability | `Alt+Q/W/E/R` |
| Quick cast with indicator | `Shift+Q/W/E/R` |

The problem appears when macOS System Settings swaps `Control` and `Command`
for an external keyboard. The physical `Ctrl+Q` then produces `Command+Q`,
which macOS handles as **Quit League of Legends** before the game can use it.

## Recommended fix

Restore the keyboard's modifier keys to their defaults:

1. Open **System Settings > Keyboard > Keyboard Shortcuts > Modifier Keys**.
2. Select the external keyboard, not the Mac's built-in keyboard.
3. Click **Restore Defaults**.
4. Repeat for each connection mode if the keyboard can use Bluetooth and a USB
   receiver. macOS stores a separate mapping for each mode.
5. Reconnect the keyboard or log out and back in if the change is not immediate.

With the default mapping, use the keys in their normal Windows positions:

- Physical `Ctrl` sends Control, so `Ctrl+Q/W/E/R` levels abilities.
- Physical `Alt` sends Option/Alt, so `Alt+Q/W/E/R` self-casts.
- The Windows/Command key remains Command and is not a League modifier.

## Command-line helper

`scripts/modifier-keys.sh` shows per-device modifier mappings and can delete a
selected mapping. It only uses tools included with macOS.

```bash
./scripts/modifier-keys.sh list
./scripts/modifier-keys.sh reset com.apple.keyboard.modifiermapping.VENDOR-PRODUCT-LOCATION
```

The reset command asks for confirmation and only removes the key named on the
command line. Run `list` first and use the identifier shown for your keyboard.
You can undo the reset by configuring that keyboard again in System Settings.

## Verify League's bindings

Open **League of Legends > Settings > Hotkeys** and confirm:

- **Abilities and Summoner Spells > Level Up Spell** uses `Ctrl`.
- **Abilities and Summoner Spells > Self Cast** uses `Alt`.

League may store these values in `Config/input.ini`. Typical entries are:

```ini
evtSelfCastSpell1=[Alt][q]
evtLevelSpell1=[Ctrl][q]
```

Prefer changing hotkeys through the game. Riot can synchronize or regenerate
`input.ini`, so this project deliberately does not overwrite it.

## Espanol

El arreglo recomendado es volver a los modificadores predeterminados del
teclado externo. En **Ajustes del Sistema > Teclado > Funciones rapidas de
teclado > Teclas modificadoras**, selecciona el teclado y pulsa **Restaurar
valores por omision**. Repite el cambio para Bluetooth y el receptor USB si
aparecen como dispositivos distintos.

Luego `Ctrl+Q/W/E/R` sube habilidades y `Alt+Q/W/E/R` autocastea, igual que en
Windows. No intercambies `Control` y `Command` globalmente: eso convierte el
`Ctrl+Q` fisico en el atajo `Command+Q` de macOS para cerrar la aplicacion.

## License

MIT
