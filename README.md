# ⚽ Ballgames Physics – v4.2

Game thể thao ragdoll vui nhộn: 2 đội × 2 cầu thủ, mỗi đội chỉ **1 nút**.

## 📥 Tải về
- 📱 **Android:** [tải APK](https://github.com/hungpt06013/ballgames-physics/releases/latest/download/BallgamesPhysics.apk) – cài đè lên bản cũ, giữ nguyên dữ liệu
- 🌐 **Chơi online:** https://hungpt06013.github.io/ballgames-physics/
- 💻 **Chơi offline trên máy tính:** tải [BallgamesPhysics.html](https://github.com/hungpt06013/ballgames-physics/raw/main/dist/BallgamesPhysics.html) rồi mở bằng Chrome

| | |
|---|---|
| ![Menu](docs/screens/menu.png) | ![Sét đánh trên Mặt Trăng](docs/screens/moon_lightning.png) |
| ![Bóng khổng lồ](docs/screens/giant_tornado.png) | ![Highlight: cứu thua](docs/screens/highlight_save.png) |
| ![Thống kê trận + MVP](docs/screens/match_stats.png) | ![Người chơi · Trang phục](docs/screens/players.png) |

## 🎮 Cách chơi
| | |
|---|---|
| 👆 **Bấm** | nhảy + vung chân sút |
| ✊ **Giữ khi đang bay** | lộn người – móc xe đạp |
| ↗️ **Mẹo** | bấm lúc người nghiêng về trước để lao lên |
| 🦵 **Giữ nút quá 5 giây** | chân mỏi, tự hạ xuống |

**Chạm:** đấu bot – đâu cũng được · 2 người – nửa trái / phải · 4 người – mỗi người 1 góc · online – đâu cũng được.
**Bàn phím:** Đỏ `A` `W` `Space` · Xanh `L` `↑` `Enter` · 4 người `A` `G` `K` `↑` · `Esc` tạm dừng.

## 🏟️ 8 môn
⚽ Bóng đá · 🏀 Bóng rổ · 🏈 Bóng bầu dục · 🏐 Bóng chuyền bãi biển · 🌙 Bóng đá Mặt Trăng · 🧊 Sân băng · 🎈 Bóng khổng lồ · 💣 Bóng bom (bom nổ bên sân ai thì người đó thua)

## 👥 Chế độ
- 🤖 Đấu bot (Dễ / Thường / Khó) · 👥 2 người · 🙋 4 người · 🤝 2 vs 2 – thỉnh thoảng bot cũng giữ nút làm **xe đạp chổng ngược** (hiếm: bot Khó khoảng 1 lần mỗi 6 phút)
- Ở 2 người / 4 người / 2 vs 2, chạm vào ô từng người để đổi: người → bot Dễ → Thường → Khó. Mỗi bot một độ khó riêng; để tất cả là bot thì ngồi xem
- Thắng khi đủ điểm hoặc hết giờ; hết giờ mà hoà thì chọn 🤝 hoà hay ⭐ bàn vàng
- 🎓 Hướng dẫn 3 bước cho người mới
- 🌐 **Chơi online** với bạn bè ở máy khác: một người **tạo phòng**, gửi **mã phòng 5 ký tự** cho mọi người **vào phòng**; chơi 👥 2 người / 🙋 4 người / 🤝 2 vs 2, chỗ trống để bot. Miễn phí, không cần tài khoản. Bấm là thấy ngay trên máy mình (game tự đoán trước rồi sửa êm khi biết nút của người khác), và mọi máy luôn ra đúng một trận như nhau

## ✨ Trong trận (bật / tắt khi tạo trận)
- 🎁 **Vật phẩm:** 🔥 siêu sút · 🛡️ khiên · 🧲 nam châm · ❄️ đóng băng · 🍄 phóng to
- 🎲 **Biến thể:** 2 bóng · người khổng lồ / tí hon · sàn nhún · xà di động · bóng siêu nảy · trọng lực thấp · quay chậm
- ⛈️ **Thời tiết:** 🌫️ sương mù · 🏚️ động đất · ⚡ sấm sét · 🌪️ lốc xoáy

## 🏆 Sau trận
- 📊 **Thống kê trận**: kiểm soát bóng · bóng ở phần sân đối phương · sút (trúng đích) · trúng cột / xà · suýt vào · phá bóng
- Thống kê từng người: ⚽ bàn thắng · 🧤 cứu thua · 🛑 chặn bóng · 🎯 sút trúng đích · 👟 chạm bóng + 🏅 MVP
- 🎬 Highlight (bàn thắng, cứu thua, suýt vào) – tải về thành video MP4
- 📜 Lịch sử trận · 🛒 Cửa hàng (18 mũ, 12 kiểu tóc, 12 áo, 14 quả bóng) · ⚙️ Cài đặt vật lý · 🌙 Giao diện tối
- 👤 Người chơi: đổi tên, chọn đồ theo từng mục 🎩 Mũ · 💇 Tóc · 👕 Áo cho mỗi người **và cho bot**, ⚽ Bóng dùng chung
- 🎨 **Mỗi người một màu áo** ở mọi chế độ (cả 2 vs 2 – quần theo màu đội): 16 màu, không có 2 màu nào gần giống nhau, không bao giờ 2 người trùng màu; tên nhỏ trên đầu mỗi cầu thủ; bóng / người bay quá màn hình có cả độ cao (vd. "12m")

## 🛠️ Cho người sửa game
- Code nằm trong `www/`: `engine.js` (vật lý, bot), `game.js` (luồng game), `draw.js` (hình), `audio.js` (âm thanh), `net.js` + `online.js` (chơi online). Mở `www/index.html` bằng Chrome là chơi được.
- Kiểm tra: `node test/sanity2.cjs`; các bài dùng Playwright như `node test/cases.cjs`; cứu thua: `node test/sweep.cjs` (66.906 tình huống chấm lại bằng một trọng tài độc lập); thống kê trận + chặn bóng: `node test/stats.cjs` (2.505 tình huống, cũng có trọng tài độc lập); chơi online: `node test/netsync.cjs` (mạng giả lập) và `node test/online.cjs` (trình duyệt thật).
- **APK:** GitHub tự build và ký mỗi khi đẩy code (khoá nằm trong secret `KEYSTORE_B64`, không có trong repo). Ra bản mới thì tăng `VERSION_CODE` trong `android/version.env`.
- File HTML chơi offline: `python3 build_html.py dist/BallgamesPhysics.html`
- Mọi luật chính xác và ghi chú kỹ thuật: [CHI_TIET.md](CHI_TIET.md)
