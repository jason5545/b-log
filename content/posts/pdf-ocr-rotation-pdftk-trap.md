# 解決 PDF OCR 後頁面旋轉異常的問題：一個隱藏在 pdftk 書籤還原中的陷阱

## 前言

最近在批次處理大量 PDF 文件的 OCR 工作時，遇到了一個非常棘手的問題：明明原始 PDF 頁面方向正常，OCR 處理後某些頁面卻莫名其妙地旋轉了。這個問題困擾了我好一陣子，最後發現罪魁禍首竟然是 pdftk 的書籤還原功能。在此記錄整個除錯過程，希望能幫助遇到相同問題的人。

## 背景

我需要對大量 PDF 進行 OCR 處理，這些 PDF 包含中英文混合內容，且原始文件帶有書籤。我的處理流程是：

1. 使用 `pdftk dump_data` 提取原始書籤
2. 使用 `ocrmypdf` 進行 OCR 處理
3. 使用 `ghostscript` 壓縮檔案
4. 使用 `pdftk update_info` 還原書籤

OCR 的參數設定如下：

```bash
ocrmypdf -l eng+chi_tra \
         --force-ocr \
         --optimize 3 \
         --output-type pdf \
         input.pdf output.pdf
```

## 問題發現

處理完成後，我發現某些 PDF 的第 4、5 頁方向不對，原本正常的頁面變成了旋轉 90 度的狀態。奇怪的是，原始檔案開啟完全正常。

我首先懷疑是 `ocrmypdf` 的 `--rotate-pages` 參數造成的問題（雖然我沒有使用這個參數），於是開始了漫長的除錯之旅。

## 除錯過程

### 第一步：檢查原始 PDF 的頁面資訊

使用 `pdftk dump_data` 檢查原始 PDF：

```bash
pdftk original.pdf dump_data | grep -E "PageMedia"
```

輸出結果：

```
PageMediaNumber: 1
PageMediaRotation: 0
...
PageMediaNumber: 4
PageMediaRotation: 270
PageMediaRect: 0 0 841.92 595.2
...
PageMediaNumber: 5
PageMediaRotation: 270
```

這裡發現了關鍵資訊：**原始 PDF 的第 4、5 頁帶有 `PageMediaRotation: 270` 的 metadata**。這表示這些頁面在 PDF 結構中是以旋轉 270 度的方式儲存的，PDF 閱讀器會根據這個 metadata 將頁面旋轉回正確方向顯示。

這種情況通常發生在掃描檔：第 4、5 頁可能是橫式文件，掃描時「躺著」進紙，同事後來用 PDF 編輯器（如 PDFelement）旋轉讓它顯示正常。但多數 PDF 編輯器的旋轉功能只修改 metadata，不會重新渲染像素內容——這樣處理速度快、不損失品質，但會留下 `PageMediaRotation` 記錄。

換句話說，原始 PDF 的實際結構是：
- **內容層**：第 4、5 頁的像素是「躺著的」
- **Metadata 層**：`Rotation: 270` 告訴閱讀器「顯示時轉 270 度」

兩者配合，顯示結果正常。但這個「表面正常」在後續處理中埋下了隱患。

### 第二步：檢查 OCR 後的輸出

對 OCR 處理後（但尚未還原書籤）的 PDF 進行檢查：

```bash
pdftk ocr_output.pdf dump_data | grep -E "PageMediaRotation"
```

輸出結果：

```
PageMediaRotation: 0
PageMediaRotation: 0
PageMediaRotation: 0
PageMediaRotation: 0
PageMediaRotation: 0
```

**所有頁面的 Rotation 都是 0！** 這表示 `ocrmypdf` 在處理過程中已經將旋轉「烤入」(bake in) 頁面內容中，輸出的 PDF 不再需要 rotation metadata。

### 第三步：發現真正的問題

接下來檢查還原書籤後的 PDF：

```bash
pdftk final_with_bookmarks.pdf dump_data | grep -E "PageMediaRotation"
```

輸出結果：

```
PageMediaRotation: 0
PageMediaRotation: 0
PageMediaRotation: 0
PageMediaRotation: 270  # 問題出現了！
PageMediaRotation: 270
```

**第 4、5 頁的 rotation 又變回 270 了！**

這時我才恍然大悟：`pdftk dump_data` 輸出的不只是書籤資訊，還包含了 `PageMedia` 資訊（包括 rotation）。當我使用 `pdftk update_info` 還原書籤時，它同時也把原始的 `PageMediaRotation: 270` 寫回去了。

但此時 PDF 的實際內容已經是正確方向的（因為 ocrmypdf 已經處理過），再加上 rotation metadata 就導致頁面被「二次旋轉」，造成顯示異常。

## 解決方案

解決方法很簡單：**在還原書籤時，過濾掉 PageMedia 相關的資訊，只保留 Info 和 Bookmark 資料**。

原本的書籤提取方式：

```bash
pdftk input.pdf dump_data > bookmarks.txt
```

修改後：

```bash
pdftk input.pdf dump_data | grep -E "^(InfoBegin|InfoKey:|InfoValue:|NumberOfPages:|BookmarkBegin|BookmarkTitle:|BookmarkLevel:|BookmarkPageNumber:)" > bookmarks.txt
```

這個 grep 命令只保留：
- `InfoBegin`, `InfoKey:`, `InfoValue:` - PDF 文件資訊
- `NumberOfPages:` - 頁數資訊
- `BookmarkBegin`, `BookmarkTitle:`, `BookmarkLevel:`, `BookmarkPageNumber:` - 書籤資訊

排除了所有 `PageMedia` 開頭的行，包括 `PageMediaRotation`。

## 完整的處理腳本

最終的處理腳本如下：

```bash
#!/bin/bash

# OCR 處理 PDF
# 書籤還原時過濾 PageMedia 避免旋轉問題

process_pdf() {
    local input="$1"
    local output="$2"

    # 步驟 1: 提取書籤 (過濾 PageMedia)
    pdftk "$input" dump_data | \
        grep -E "^(InfoBegin|InfoKey:|InfoValue:|NumberOfPages:|BookmarkBegin|BookmarkTitle:|BookmarkLevel:|BookmarkPageNumber:)" \
        > /tmp/bookmarks.txt

    # 步驟 2: OCR 處理
    ocrmypdf -l eng+chi_tra \
             --force-ocr \
             --optimize 3 \
             --output-type pdf \
             "$input" /tmp/ocr_output.pdf

    # 步驟 3: 壓縮
    gs -sDEVICE=pdfwrite \
       -dCompatibilityLevel=1.7 \
       -dPDFSETTINGS=/ebook \
       -dNOPAUSE -dQUIET -dBATCH \
       -sOutputFile=/tmp/compressed.pdf \
       /tmp/ocr_output.pdf

    # 步驟 4: 還原書籤
    if grep -q "BookmarkTitle" /tmp/bookmarks.txt; then
        pdftk /tmp/compressed.pdf update_info /tmp/bookmarks.txt output "$output"
    else
        mv /tmp/compressed.pdf "$output"
    fi

    # 清理暫存檔
    rm -f /tmp/bookmarks.txt /tmp/ocr_output.pdf /tmp/compressed.pdf
}
```

## 技術要點總結

1. **PDF 的頁面旋轉有兩種方式**：
   - 實際內容旋轉（像素層面）
   - Rotation metadata（告訴閱讀器如何顯示）

2. **ocrmypdf 的 --force-ocr 會重新渲染頁面**：
   - 輸出的 PDF 內容已經是正確方向
   - Rotation metadata 會被設為 0

3. **pdftk dump_data 輸出包含多種資訊**：
   - Info（文件資訊）
   - Bookmark（書籤）
   - PageMedia（頁面尺寸、旋轉等）

4. **pdftk update_info 會覆蓋所有對應的 metadata**：
   - 如果輸入檔包含 PageMedia 資訊，會一併寫入
   - 這可能導致與實際內容不符的 rotation 被寫入

## 結語

這個問題的根本原因是 `pdftk` 的 `dump_data` 和 `update_info` 功能設計上是處理所有 PDF metadata，而不只是書籤。在大多數情況下這不會造成問題，但當 PDF 經過 OCR 處理（內容被重新渲染）後，原始的 rotation metadata 就不再適用了。

這次經驗讓我深刻體會到：**在處理 PDF 時，要特別注意 metadata 和實際內容之間的一致性**。看似簡單的「保留書籤」操作，如果沒有仔細過濾資料，可能會帶來意想不到的副作用。

希望這篇文章能幫助到遇到類似問題的朋友。如果你也在進行 PDF OCR 處理並需要保留書籤，記得過濾掉 PageMedia 資訊！
