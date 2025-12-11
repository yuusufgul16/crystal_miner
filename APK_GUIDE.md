# Mobil APK için Hazırlama Rehberi

## ✅ Yapılan Optimizasyonlar

### 1. Viewport ve Meta Tags
- No-zoom viewport (mobil için sabitlendi)
- PWA capable meta tags
- Theme color ayarlandı (#1a1a2e)
- Portrait orientation

### 2. CSS Optimizasyonları
- **Container:** Full width (100%)
- **Level Grid:** 2 sütun (mobilde 1)
- **Game Grid:** 5 sütun (küçük ekranlarda 4)
- **Touch Targets:** Min 48px (erişilebilirlik)
- **Font Sizes:** Mobil için küçültüldü
- **Tap Highlight:** Devre dışı (daha temiz görünüm)

### 3. PWA Manifest
- Display: Standalone
- Orientation: Portrait (dikey)
- Theme colors

### 4. Icon'lar
- 192x192 px
- 512x512 px
- Kristal + Kazma tasarımı

## 📱 APK Oluşturma Adımları

VE 1: **PWA Builder Kullan**
https://www.pwabuilder.com/
1. URL'i gir veya dosyaları yükle
2. Generate Android Package
3. APK indir

### Seçenek 2: **Apache Cordova**
```bash
npm install -g cordova
cordova create CrystalMiner com.example.crystalminer "Kristal Madencisi"
cd CrystalMiner
# www klasörüne dosyaları kopyala
cordova platform add android
cordova build android
```

### Seçenek 3: **Capacitor (Önerilen)**
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Kristal Madencisi" com.example.crystalminer
npx cap add android
npx cap copy
npx cap open android
```

## 📐 Mobil Boyutlar

**Test edilen:**
- 375x667 (iPhone SE)
- 390x844 (iPhone 12/13)
- 412x915 (Pixel 5)
- 360x640 (Small Android)

**Grid ayarları:**
- Büyük ekran (>375px): 5 sütun
- Küçük ekran (<375px): 4 sütun
- Level grid: 2 sütun (çok küçük: 1)

## 🎮 Optimizasyon Detayları

- Touch-friendly (min 48px)
- No scroll horizontal
- Vertical scrolling enabled
- No pinch zoom
- Fast tap (no 300ms delay)
- Smooth animations
