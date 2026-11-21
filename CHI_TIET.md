# Ballgames Physics – chi tiết luật và kỹ thuật (v3.3)

Bản ngắn gọn: [README](README.md). Ở đây là mọi luật chính xác và ghi chú kỹ thuật, cho ai sửa game.

Game 2 đội × 2 cầu thủ ragdoll, mỗi đội **1 nút** (bấm = nhảy + vung chân sút, giữ khi đang bay = xoay người).
- **Giữ nút tối đa 5 giây**: từ giây thứ 1 chân đang giơ bắt đầu mỏi (run run, hạ dần), tới giây thứ 5 thì về chỗ cũ và nút giữ không còn tác dụng (không sút, không xoay người) cho tới khi thả ra bấm lại.
- **💤 Ngủ gật** (luật như nhau cho mọi cầu thủ, bên công hay bên thủ, ở đâu trên sân): không bấm nút 3 giây thì ngủ gật – mặt nhắm mắt, chữ Z bay trên đầu. Ngủ gật tăng dần trong 4 giây: lắc lư rộng hơn (không ngã hẳn) và người "mềm" hơn (cú sút mạnh đập vào thì đẩy bật người ra chứ không dội lại như bức tường). Đang ngủ gật mà bấm thì lần bấm đầu chỉ **giật mình tỉnh tại chỗ** (nhún nhẹ, không vung chân, không nhảy), lần bấm sau mới nhảy + sút như thường. Nên đứng chắn khung thành vẫn là một chiến thuật, nhưng phải bấm đều tay; bấm để tỉnh không bao giờ làm bỏ trống khung thành. Bot cũng tự bấm để tỉnh (bot Khó gần như ngay, bot Dễ chậm hơn). Hướng dẫn và màn menu không có ngủ gật.
- Cầu thủ đứng yên lắc lư **đều hai bên** (nghiêng trước và sau như nhau); cú nhảy vẫn hướng về phía trước như trước.
- Chân của hai cầu thủ không móc vào nhau nữa (chân chỉ va vào người khác khi đang vung sút). Đồng đội không đá / hất nhau: đứng sát sau đồng đội rồi cùng nhảy không còn hất người phía trước bay cao gấp đôi.
Khi vào trận, tích chọn các môn muốn chơi; chọn nhiều môn thì sau mỗi điểm đổi sang môn khác.

## 8 môn
Bóng đá, bóng rổ, bóng bầu dục, bóng chuyền bãi biển, bóng đá Mặt Trăng, sân băng, bóng khổng lồ,
**bóng bom** (bom 12 giây, nổ bên sân ai thì người đó thua).
Khung thành bóng đá / Mặt Trăng / sân băng cao 330, sâu 165 (sân băng bản cũ chỉ cao 230, sâu 130); bóng khổng lồ cao 400, sâu 300 (bản cũ 180). Khung thành luôn sâu hơn đường kính quả bóng ít nhất 70, nên dù chỉnh cỡ bóng tối đa (×1,6) và bật người mới thì bóng vẫn lọt hẳn vào được; chế độ người mới làm khung cao hơn.
Các môn có khung thành (bóng đá, Mặt Trăng, sân băng, bóng khổng lồ): bàn thắng chỉ tính khi **cả quả bóng đã vượt qua vạch vôi** trước khung thành (vạch trắng trên sân).
Bóng rổ: cầu thủ không vượt qua **bảng rổ trắng** (không ra sau bảng, không đứng lên trên bảng); bóng rổ chỉ tính điểm khi quả bóng **đã nằm hẳn trên vành rổ** rồi mới rơi xuống qua vành (bóng tới ngang vành, nửa trên nửa dưới, không tính); sàn ngoài sân phía sau trụ rổ chỉ nảy rất ít, để bóng không nảy cao ở ngoài rồi rơi vào rổ.
Bóng bầu dục: cầu thủ không đi ra sau cột dọc được, tối đa là đứng trên đỉnh cột.
Các môn có khung thành: cầu thủ **không đứng lên nóc khung thành** được (bị đẩy ra phía sân); bên trong khung thành (dưới xà) vẫn vào được.
Bóng được thả lại giữa sân khi nằm **ngoài biên** (trên nóc khung thành, sau cột rổ, sau cột bầu dục) đủ 3 giây, hoặc khi **nằm im 15 giây mà không ai chạm** (kể cả nằm vắt trên vạch vôi), ở mọi chế độ (người với người, đấu bot, 4 người, 2 vs 2); riêng bóng bom thì không, vì bom tự nổ.
3 giây trước khi thả lại, game báo "⚠️ Bóng sẽ được phát lại ở giữa sân sau 3… 2… 1 giây" (kèm tiếng bíp) và đánh dấu chỗ bóng sẽ rơi xuống.
Cầu thủ ngã (kể cả lộn ngược) tự bật dậy sau khoảng 0,3 giây và xoay vừa đủ để tiếp đất bằng chân; chạm nút lúc đang nằm cũng bật dậy ngay.

## Chế độ
- **2 người** – mỗi đội 1 nút (chạm nửa trái / nửa phải màn hình).
- **Đấu bot** – Dễ / Thường / Khó (bot mô phỏng vật lý trước để chọn lúc bấm). Chọn **bạn chơi bên ◀ Trái (đỏ) hay Phải (xanh) ▶**; nút bấm của bạn và ô "BOT …" nằm đúng phía của mỗi bên.
- **4 người (điểm riêng)** và **2 vs 2** – mỗi người 1 góc màn hình; ô trống có thể để **bot** (vd. 2 người chung đội đấu 2 bot).
  Khung thành mang màu người chạm bóng cuối; sau mỗi ván người trước/sau đổi chỗ.
- **Hướng dẫn** 3 bước tương tác (nhảy → sút → xoay người), lần đầu xong được +30 xu.
- Thể thức: tự nhập **số điểm để thắng** (1–99) hoặc **số phút** (0,5–60). Chọn môn bóng bom thì nhập được **số giây trước khi bom nổ** (3–60).
- Hết giờ mà đang hoà: **mỗi người chơi chọn** 🤝 hoà hay ⭐ bàn thắng vàng (bot không chọn). Số người chọn bàn vàng ≥ số người chọn hoà thì đá tiếp, ai ghi trước thắng; không thì trận kết thúc với tỉ số hoà.

## Trong trận
- **Biến thể ngẫu nhiên** mỗi ván: 2 quả bóng (bóng bầu dục: cả 2 quả đặt cạnh nhau ở giữa sân), người khổng lồ/tí hon, sàn bật nhún, xà ngang di động, bóng siêu nảy, trọng lực thấp, quay chậm.
- **Vật phẩm** rơi bằng dù: 🔥 siêu sút, 🛡️ khiên chắn khung thành, 🧲 nam châm hút bóng, ❄️ đóng băng đối thủ, 🍄 phóng to.
- **Thời tiết & thiên tai**:
  - 🌫️ sương mù: cứ 5–10 giây lại mờ đi khoảng 6 giây.
  - 🏚️ động đất: 8–15 giây một lần, rung 10 giây, đất văng, mọi người lắc lư nhưng vẫn điều khiển được.
  - ⚡ sấm sét: 8–15 giây một lần, có mây và vòng vàng báo trước 0,8 giây.
    - Trúng đất: thành hố 5 giây.
    - Trúng người: cháy đen, đứng im 5 giây.
    - Trúng bóng: 5 giây sau dừng ván, không ai được điểm, phát lại cú sét, đá lại cùng môn.
    - Trúng bom: nổ luôn, không ai được điểm.
  - 🌪️ lốc xoáy: 8–15 giây một lần, ở một phần tư sân bất kỳ, hút người và bóng lên rồi xoay khoảng 6 giây; khung thành không bị ảnh hưởng.
  - Đếm giờ chỉ chạy khi không có hiện tượng nào. Khi một hiện tượng đến: 90% các bộ đếm khác reset (chỉ có 1 hiện tượng), 9% có 2 hiện tượng cùng lúc, 0,9% có 3, 0,1% có cả 4.
- Mỗi mục trên bật/tắt riêng, và khi bật thì **tích chọn từng thứ** muốn có.
- **Phát lại** mỗi bàn thắng (chạm để bỏ qua): bắt đầu từ 5 giây trước cú chạm bóng cuối của bên được điểm (với phản lưới là cú sút trúng người bên kia rồi vào lưới), chạy tốc độ thường rồi quay chậm từ ngay trước cú sút (nhiều nhất 2,5 giây trước khi bóng vào) và chậm luôn tới hết phát lại, lúc bóng vào có vòng sáng quanh quả bóng; vật phẩm, khiên, đóng băng, phóng to, thời tiết hiện đúng như lúc diễn ra; bóng hay người bay lên trời có mũi tên ngay dưới vạch đen; kèm bình luận: phản lưới, xe đạp chổng ngược (chỉ khi thật sự lộn ngược trên không: đầu thấp hơn hông, đang bay, chân vung lên), đánh đầu, sút xa, chớp nhoáng…
- **Tên người chơi trong trận**: chế độ 2 người / đấu bot hiện tên hai bên cạnh tỉ số (bot ghi theo mức: "🤖 Bot Dễ / Thường / Khó"); chế độ 4 người / 2 vs 2 hiện bảng tên trên đầu từng người (ô để bot ghi "🤖 Bot Khó"…).
  Khi xem lại (phát lại hay highlight) **mọi chữ nằm trong hai dải đen trên / dưới, không che sân**: dải trên ghi PHÁT LẠI / HIGHLIGHT, tên pha, MVP (và nút ✖); dải dưới ghi lời bình, đúng lúc bóng vào / cứu thua / suýt vào thì đổi thành "VÀO! ✔" / "🧤 CỨU THUA!" / "😱 SUÝT VÀO!", hai bên là QUAY CHẬM và Chạm để bỏ qua.
- Cầu thủ có **nét mặt** (gắng sức, vui, buồn, choáng, lạnh cóng), đội ghi bàn ăn mừng, khán giả nhảy múa.
- **Nhạc nền** tự tạo kiểu nhạc sân vận động sôi động: trống bass đều 4 phách, clap, hi-hat dồn, bass nảy quãng tám, hợp âm dập, giai điệu bắt tai, dồn trống cuối mỗi câu; mỗi môn một chất (bóng đá 148 nhịp/phút, bãi biển 128, Mặt Trăng 134 kiểu synth, bóng bom 162 căng thẳng, menu 118). 10 giây cuối trận tính giờ và lúc đá bàn vàng nhạc dồn dập hơn. Kèm tiếng khán giả; bật/tắt riêng nhạc và hiệu ứng.

## Sau mỗi trận đấu
Một trận là từ lúc bắt đầu đến khi có người chạm mốc điểm / hết giờ / hoà (không phải từng bàn).
- **Thống kê từng người**: ⚽ bàn thắng · 🧤 cứu thua · 🎯 sút trúng đích · 👟 chạm bóng · 😬 phản lưới (nếu có) và **⭐ điểm** (3,0–10,0; trận bình thường khoảng 6), người điểm cao nhất là **🏅 MVP**.
  Kết quả và cách biệt tỉ số ảnh hưởng nhiều nhất (thua 1–6 chỉ còn khoảng 4 điểm, thắng đậm khoảng 9–10), sau đó tới bàn thắng, cứu thua (+0,4 mỗi pha), sút trúng đích, chạm bóng; phản lưới bị trừ (−0,45 mỗi bàn).
  Ở chế độ 2 người / đấu bot mỗi bên là 1 người (1 nút điều khiển cả 2 cầu thủ); ở 4 người / 2 vs 2 mỗi ô là 1 người.
- **🎬 Highlight**: mọi bàn thắng, các ván bị dừng vì sét đánh trúng bóng, những pha **cứu thua** và những pha **suýt vào**.
  Cứu thua = một **cú sút thật** (bóng bay nhanh từ 400 trở lên theo **mọi hướng**, kể cả bóng bổng đang rơi xuống khung thành; sút trước lúc chặn ít nhất 0,15 giây) sắp vào trong khoảng 1,6 giây (kể cả bóng lốp còn nảy 1 lần rồi mới lăn vào) thì bị cầu thủ bên kia chặn lại **ở nửa sân nhà**, và người đó **có làm gì đó**: vừa bấm nút trong vòng 0,35 giây trước khi chạm bóng (sút, đánh đầu, hay bóng trúng người lúc đang bật lên), hoặc đang **bật nhảy / bay người** do chính mình bấm (trong vòng 1,5 giây trước). Thủ môn đẩy bóng ra rồi bóng chết lại trên người anh ta (hay đồng đội) vẫn là cứu thua của anh ta. Phá bóng mạnh lên phía khung thành đối phương vẫn được tính. Cứu xong mà đồng đội đánh đầu trả về hay đối thủ sút lại rồi thủ môn cứu tiếp thì là **cứu thua liên tiếp ×2**. **Và chính việc người đó làm phải là thứ giữ bóng lại**: game phát lại vài giây vừa rồi như thể người đó (ở chế độ 2 người / đấu bot là cả đội, vì chung 1 nút) **không bấm** từ lúc bắt đầu pha đó; nếu khi ấy bóng vẫn không vào – ví dụ bóng đi thẳng vào chân / người anh ta hay đồng đội nên đứng yên cũng chặn được – thì **không phải cứu thua**, dù có bấm sút phá. Cứu thua thật là những pha bóng sẽ vào nếu không làm gì: bay người đánh đầu cú sút qua đầu, nhảy phá bóng lốp, chặn bóng đang đi qua mình… Đứng yên để bóng đập vào người, bị va chạm hất lên không rồi bóng trúng người, chen nhau đẩy bóng trước khung thành, khiên chắn, hay chặn ở nửa sân đối phương đều không tính. Nếu chặn rồi mà bóng vẫn lăn vào lưới (bên sút không chạm thêm) thì cũng không tính là cứu thua.
  Các pha cứu thua liên tiếp (cách nhau dưới 3 giây, cùng một bên) gộp thành 1 pha lớn và luôn có trong highlight; với các pha cứu thua lẻ, giữ khoảng 1/3 pha nguy hiểm nhất.
  Bóng đã vào thì không bao giờ hiện "😱 SUÝT VÀO!" cho bên ghi bàn (vd. dội xà rồi vào, hay lăn trên vạch rồi vào): pha suýt vào đó là cùng một đợt tấn công và bóng đã vào.
  Suýt vào = cú sút không vào (và không ai chạm vào bóng trước khi nó tới khung thành / rổ / cột) nhưng **đường bay thật của bóng** (game theo dõi quả bóng từng bước sau cú sút cho tới khi có người chạm vào, không đoán trước) đi rất sát: dội xà, bay sát trên xà (đo ngay tại vạch vôi, cách xà chưa tới khoảng 1 quả bóng), lăn dừng ngay trên vạch, rơi trúng vành rổ / sát mép vành, sượt dưới xà ngang hoặc dội cột dọc bóng bầu dục. Bóng bổng rơi lên nóc khung thành, bóng bay cao vút rồi rơi xa khung thành, bóng đi lên từ dưới vành rổ, bóng còn đang lăn tới khi hết thời gian xét, hay bóng bị người chặn ngay trên vạch / dưới vành đều **không** tính. Mỗi pha được chấm điểm đẹp (càng sát càng cao, cộng thêm khi dội cột / vành, sút xa, sút trên không, sút mạnh) và highlight lấy **20% pha đẹp nhất** (làm tròn lên).
  Pha nào cũng có quay chậm lúc vào lưới / lúc cứu thua / lúc suýt vào. Các pha chồng lên nhau trong cùng một ván (vd. cứu thua rồi phản công ghi bàn luôn) được gộp thành 1 đoạn, không chiếu 2 lần. Xem ngay ở màn hình cuối trận hoặc trong Lịch sử (chạm để sang pha tiếp, ✖ để thoát). Pha ghi bàn dài như đoạn phát lại trong trận. Giữa các pha là một nhịp tối màn hình ngắn.
  Highlight **có tiếng** như lúc đá (sút, đánh đầu, bóng nảy, dội cột, khiên, nhảy, nổ bom, vật phẩm, sấm sét, động đất, lốc xoáy, còi và tiếng hò reo khi ghi bàn, tiếng khán giả). Dải đen phía trên hiện **tên hai bên ngay trên tỉ số** (bot ghi "🤖 Bot Khó"…), **tỉ số ngay lúc đó** (bàn thắng được cộng đúng lúc bóng vào) và **thời gian còn lại của trận** (⏱ 1:23, hết giờ thì ⭐ BÀN VÀNG) hoặc **Chạm N**; dải dưới hiện tên pha và lời bình.
- **⬇️ Tải highlight**: tạo video **MP4 Full HD (1920×1080, 30 hình/giây)** của highlight trận đó, H.264 (máy không có H.264 thì VP9, vẫn là file .mp4). Video được vẽ **từng khung hình đều nhau** rồi nén, không phải quay màn hình, nên không giật dù máy yếu. Nó được làm **ở chế độ nền**: bấm tải xong bạn cứ chơi tiếp (menu, trận mới…), góc dưới có ô "⬇️ Đang tạo video 42% ✖", xong thì báo đã lưu. Điện thoại: lưu vào **Movies/Ballgames** (Android 9 trở xuống sẽ hỏi quyền bộ nhớ; nếu từ chối thì lưu vào thư mục riêng của app). Trình duyệt: tải về như file bình thường. Video **có tiếng** (AAC, máy không có AAC thì Opus), dựng lại từ chính âm thanh của game theo đúng từng khung hình. Máy quá cũ không có WebCodecs thì quay màn hình trong lúc phát highlight như bản cũ.
- **📜 Lịch sử trận đấu**: ngày giờ, chế độ, mức bot, thể thức, các môn, tỉ số, thắng/thua/hoà, thời lượng, danh sách bàn thắng, bảng thống kê. Lọc theo chế độ (2 người / đấu bot / 4 người / 2 vs 2), mức bot (Dễ / Thường / Khó), kết quả (thắng bot / thua bot / hoà), môn; sắp xếp mới nhất / cũ nhất / cách biệt nhiều nhất; nút **✔ Xong** nhỏ, luôn ghim ở dưới dù danh sách dài. Lưu tối đa 500 trận.
- **Lưu highlight**: lần đầu đấu xong game hỏi 1 lần: 💾 lưu tất cả / 🔢 chỉ lưu N trận gần nhất (1–100) / 🚫 không lưu (chỉ xem / tải ngay sau trận). Đổi lại trong ⚙️ Cài đặt (có xác nhận trước khi xoá bớt). Mỗi trận khoảng 0,05–0,2 MB. Bản điện thoại lưu trong máy, bản web lưu trong trình duyệt.
  Xoá để giải phóng bộ nhớ: 🗑️ từng trận trong Lịch sử, ☑️ chọn nhiều trận rồi xoá, hoặc 🗑️ xoá tất cả trong Cài đặt (tuỳ chọn xoá luôn lịch sử). Trận đã xoá highlight vẫn còn trong lịch sử; video đã tải về không bị ảnh hưởng.

## Ngoài trận
- **Xu & cửa hàng**: mũ, tóc, áo, skin bóng. Xu nhận khi thắng bot (Dễ 10 / Thường 20 / Khó 40), ghi bàn, chơi 2/4 người, học xong hướng dẫn.
- **👤 Người chơi · Trang phục**: chọn **👥 Chơi 2 người** hoặc **🙋 Chơi 4 người**. Mỗi người có 1 **thẻ dọc** vẽ đúng hình trong trận: 2 người thì mỗi thẻ là cả một bên (2 cầu thủ cùng màu đội, số áo, tên cạnh ô tỉ số); 4 người thì mỗi thẻ 1 cầu thủ với bảng tên trên đầu, xem theo kiểu 🤝 2 vs 2 (màu đội) hoặc 🙋 mỗi người 1 đội (màu riêng). Sửa tên ngay dưới thẻ; chạm thẻ để chọn mũ, tóc, áo (và màu áo riêng khi chơi 4 người).
- **Thống kê**: số trận, thắng/thua/hoà từng mức bot, chuỗi thắng bot Khó, tổng bàn, môn ghi nhiều nhất, bàn nhanh nhất.
- **Cài đặt**: lực nhảy, lực sút, trọng lực, độ nảy, cỡ bóng, tốc độ game, **độ trễ nhảy**, **độ dài tối thiểu 1 lần chạm**, bật/tắt phát lại, nhạc, hiệu ứng.
- **Chế độ người mới**: bóng/khung thành/rổ to hơn, bot hay mắc lỗi hơn.
- **🌙 Giao diện sáng / tối**: nút 🌙 / ☀️ trên menu hoặc trong ⚙️ Cài đặt; chưa chọn thì theo điện thoại. Giao diện tối đổi màu các bảng và làm sân tối lại như đá đêm.

Dữ liệu (xu, đồ, thống kê, cài đặt, lịch sử) lưu trong máy (localStorage; highlight trong IndexedDB trên web, trong bộ nhớ app trên Android); cập nhật từ bản cũ vẫn giữ cài đặt.

## Cấu trúc
- `www/engine.js` – engine vật lý (thân cứng + va chạm), 8 môn (`MAPS`), biến thể (`MODS`), vật phẩm (`ITEMS`), bot AI (`LEVELS`, `Bot`).
- `www/game.js` – luồng game, điều khiển, HUD, menu, phát lại, hướng dẫn, phát hiện cứu thua, highlight, lịch sử, thống kê trận, bình chọn khi hết giờ hoà, xuất video.
- `www/highlights.js` – nén khung hình highlight (30 hình/giây, số nguyên 16 bit, delta + gzip), lưu trữ (IndexedDB / file trong app) và lịch sử trận.
- `www/mp4.js` – ghi file MP4 (hình H.264 hoặc VP9, tiếng AAC hoặc Opus) cho video highlight.
- `www/draw.js` – vẽ sân, cầu thủ (mặt, mũ, tóc, áo), bóng, khán giả.
- `www/audio.js` – hiệu ứng âm thanh, nhạc nền, tiếng khán giả (Web Audio, không cần file âm thanh).
- `www/meta.js` – xu, cửa hàng, hồ sơ người chơi, thống kê.
- `www/index.html` – giao diện menu.
- `android/` – vỏ Android (WebView toàn màn hình, khoá màn hình ngang, nút Back, cầu nối `BGNative` để lưu highlight và video).
- `build_apk.sh` – build APK không cần Gradle (aapt2 → javac → d8 → zipalign → apksigner).
- `build_html.py` – gộp thành 1 file HTML chơi trên trình duyệt.
- `test/` – kiểm tra vật lý (`sanity2.cjs`), bot đấu nhau (`match2.cjs`), kiểm tra giao diện bằng Playwright (`v21.cjs`, `v22.cjs`, `v23.cjs`, `flow2.cjs`, `tut.cjs`, `migrate.cjs`), thời gian đứng dậy sau khi ngã (`getup.cjs`), thiên tai (`hazards.cjs`), bóng mọi cỡ đều vào được khung thành (`goalfit.cjs`), quay chậm liền mạch (`slowmo.cjs`), lời bình xe đạp chổng ngược (`bicycle.cjs`), highlight / lịch sử / thống kê / bình chọn / xuất video (`v25.cjs`), luật cứu thua, gộp pha trùng, cách tính điểm (`v26.cjs`), suýt vào theo đường bay thật, tên người chơi / bot, màn Người chơi mới (`v3.cjs`), hai pha trong video của người chơi dựng lại từ vị trí bóng đo từng khung hình (`v31.cjs`), **74 tình huống** cứu thua / không phải cứu thua (gồm sút sệt thẳng vào chân thủ môn rồi phá ra = không phải cứu thua) / suýt vào / không phải suýt vào / vào / phản lưới dựng bằng vật lý thật, cả hai bên sân, các môn, 2 vs 2, 4 người, đấu bot bên phải, 2 quả bóng, kèm chữ hiện khi xem highlight (`cases.cjs`), soát hàng loạt quyết định cứu thua / suýt vào / bàn thắng qua nhiều trận bot (`diag.cjs`), bóng nằm im 15 giây được thả lại (`stillball.cjs`), báo trước khi thả lại bóng, pha suýt vào, giao diện tối (`v28.cjs`), tạm dừng đúng lúc màn hình đang chuyển ván (`pausefade.cjs`), video MP4 làm ở chế độ nền (`video.cjs`), tiếng + tỉ số + thời gian trong highlight và video (`hlsound.cjs`), bộ ghi file MP4 với dữ liệu H.264 / VP9 thật của ffmpeg (`mp4mux.cjs`), đường đi của bản Android với cầu nối giả lập (`native.cjs`), dung lượng highlight (`hlsize.cjs`), nhạc nền mỗi môn dựng ra file không cần loa – có tiếng, không vỡ tiếng, ghi ra `test/out/music_sample.wav` để nghe thử (`music.cjs`).

## Tuỳ chỉnh vật lý
Trong game: Menu → ⚙️ Cài đặt.
Trong code: sửa từng môn ở `MAPS` trong `www/engine.js` (`g`, `gBall`, `jump`, `legSpd`, `ballR`, `ballE`, `mu`…).

## Build
**APK tự động trên GitHub** (`.github/workflows/apk.yml`): mỗi lần đẩy code lên `main` (hoặc nhánh `claude/…`, hoặc bấm *Run workflow* ở tab Actions), GitHub tự build APK và ký bằng khoá của game cất trong secret **`KEYSTORE_B64`** (nội dung file `release.jks` dạng base64; không ai đọc được secret, khoá không bao giờ nằm trong repo). Trước khi ký, nó kiểm tra đó đúng là khoá của các bản trước (SHA-256 `9C:7C:D9:AD…FF:FB:A8`); thiếu hoặc sai khoá thì dừng hẳn, không bao giờ tự tạo khoá mới. `main` → release `v<phiên bản>` (bản mới nhất); nhánh khác → pre-release "test-build".
Phiên bản app nằm ở `android/version.env` (`VERSION_CODE` phải tăng mỗi lần phát hành để điện thoại nhận là bản cập nhật).

Build trên máy: cần JDK 17+ và Android SDK (build-tools 36.1.0, platforms;android-34), file `release.jks` đặt cạnh `build_apk.sh`:
```
ANDROID_HOME=/đường/dẫn/sdk ./build_apk.sh
python3 build_html.py BallgamesPhysics.html
```
Chạy kiểm tra: `node test/sanity2.cjs` (engine), các file Playwright như `node test/v25.cjs` (cần `npm i -g playwright` và Chromium).

**Khoá ký APK** (`release.jks`) **không có trong repo** (repo công khai). Trên máy, `build_apk.sh` tự tạo khoá mới nếu chưa có (trên GitHub thì không); muốn bản build cài đè lên bản đã cài thì phải dùng đúng khoá cũ (giữ file này ở chỗ riêng, đừng đưa lên mạng).
