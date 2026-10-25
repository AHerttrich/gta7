# Technical Specification — GTA 7 📐

## Coordinate System & Units

- **Axes**: Three.js standard right-handed coordinates:
  - $+Y$: Upwards
  - $+Z$: South / Forward default
  - $+X$: East / Right
- **Units**:
  - Distance: 1 unit = 1 meter
  - Velocity: meters per second ($m/s$), displayed to the player in $km/h$ ($v_{km/h} = v_{m/s} \times 3.6$)
  - Time: Seconds ($s$)

---

## Vehicle Physics Model

Arcade driving physics balances realism with immediate, fun responsiveness:

$$a_{net} = a_{engine} - F_{drag} - F_{friction} - F_{brake}$$

### Tuning Parameters

| Parameter | Value | Description |
|---|---|---|
| `MAX_FORWARD_SPEED` | $45.0\text{ m/s}$ (~$162\text{ km/h}$) | Top speed on straight roads |
| `MAX_REVERSE_SPEED` | $12.0\text{ m/s}$ (~$43\text{ km/h}$) | Reverse speed limit |
| `ACCELERATION` | $18.0\text{ m/s}^2$ | Engine thrust |
| `BRAKE_DECELERATION` | $28.0\text{ m/s}^2$ | Standard braking force |
| `HANDBRAKE_DECELERATION`| $14.0\text{ m/s}^2$ | Handbrake slide brake |
| `DRAG_COEFFICIENT` | $0.003$ | Air resistance ($F_{drag} = C_{drag} \cdot v^2$) |
| `ROLLING_FRICTION` | $2.5\text{ m/s}^2$ | Ground friction when coasting |
| `MAX_STEER_ANGLE` | $0.65\text{ rad}$ (~$37^\circ$) | Maximum wheel turn angle |
| `STEER_SPEED` | $4.0\text{ rad/s}$ | Steering turn rate |
| `DRIFT_GRIP_LOSS` | $0.60$ | Lateral grip multiplier during handbrake |

---

## City Grid Specifications

```
+-------------------------------------------------------+
|  BLOCK (80m x 80m)  | ROAD (20m) |  BLOCK (80m x 80m) |
|  [Skyscrapers /     |            |  [Houses /         |
|   Plaza / Parks]    |  2 Lanes + |   Commercial]      |
|                     |  Sidewalks |                    |
+---------------------+------------+--------------------+
|                INTERSECTION (20m x 20m)               |
+---------------------+------------+--------------------+
```

- **Grid Size**: $N \times N$ blocks (default $6 \times 6$, total map size $600\text{m} \times 600\text{m}$).
- **Road Width**: $20\text{m}$ (Two $7\text{m}$ driving lanes + two $3\text{m}$ sidewalks).
- **Block Size**: $80\text{m} \times 80\text{m}$.
- **Building Heights**:
  - Downtown: $40\text{m} - 120\text{m}$
  - Mid-district: $20\text{m} - 45\text{m}$
  - Residential / Suburb: $8\text{m} - 18\text{m}$

---

## Key Bindings

| Key | Action |
|---|---|
| `W` / `Arrow Up` | Throttle (Accelerate forward) |
| `S` / `Arrow Down` | Brake / Reverse |
| `A` / `Arrow Left` | Steer Left |
| `D` / `Arrow Right` | Steer Right |
| `Space` | Handbrake & Drift |
| `H` | Honk Horn |
| `C` | Cycle Camera (Chase / Close / Top-Down) |
| `L` | Toggle Headlights |
| `R` | Reset Car Orientation |
| `M` | Toggle Engine & Radio Audio |
| `1`–`5` | Debug Wanted Level (⭐) |
