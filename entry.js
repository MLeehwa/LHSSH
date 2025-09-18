document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert('Login required.');
    window.location.href = 'login.html';
  }

  const barcodeInput = document.getElementById('barcodeInput');
  const partEl = document.getElementById('partNumber');
  const qtyEl = document.getElementById('quantity');
  const tagEl = document.getElementById('tagNumber');
  const dateEl = document.getElementById('scanDate');
  const msgBox = document.getElementById('messageBox');

  const successSound = new Audio('sounds/success.mp3');
  const errorSound = new Audio('sounds/error.mp3');
  const duplicateSound = new Audio('sounds/duplicate.mp3');

  let inputTimer;
  barcodeInput.focus();

  // 1. 49560-L3010 형식 바코드 파싱 함수
  function parse49560Barcode(rawBarcode) {
    try {
      // 49560-L3010 형식 파싱
      const match = rawBarcode.match(/^(\d{5})-([A-Z]\d{4})$/);
      if (!match) {
        return null;
      }
      
      return {
        partNumber: match[1], // 49560
        category: match[2],   // L3010
        fullCode: rawBarcode
      };
    } catch (error) {
      console.error('49560 바코드 파싱 오류:', error);
      return null;
    }
  }

  // 2. 49560-L3010 바코드 처리 함수
  async function process49560Barcode(parsedData) {
    try {
      const now = new Date();
      
      // 중복 체크
      const { data: existing } = await supabase
        .from('barcode_transactions')
        .select('id')
        .eq('part_number', parsedData.fullCode)
        .eq('action_type', 'IN')
        .maybeSingle();

      if (existing) {
        // 기존 기록 업데이트
        const { error: updateError } = await supabase
          .from('barcode_transactions')
          .update({
            scan_date: now.toISOString().slice(0, 10),
            scan_time: now.toISOString()
          })
          .eq('id', existing.id);

        if (updateError) {
          msgBox.textContent = '❌ 업데이트 실패: ' + updateError.message;
          errorSound.play();
        } else {
          msgBox.textContent = '✅ 기존 바코드 스캔 시간 업데이트됨.';
          duplicateSound.play();
        }
        return resetDisplay();
      }

      // 새 기록 저장
      const { error } = await supabase
        .from('barcode_transactions')
        .insert([{
          part_number: parsedData.fullCode,
          quantity: 1, // 기본 수량 1
          tag_number: `TAG_${Date.now()}`, // 자동 태그 생성
          raw_data: parsedData.fullCode,
          action_type: 'IN',
          scan_date: now.toISOString().slice(0, 10),
          scan_time: now.toISOString()
        }]);

      if (error) {
        msgBox.textContent = '❌ 저장 실패: ' + error.message;
        errorSound.play();
      } else {
        msgBox.textContent = '✅ 49560 바코드 저장 성공!';
        partEl.textContent = parsedData.partNumber;
        qtyEl.textContent = '1';
        tagEl.textContent = parsedData.category;
        dateEl.textContent = now.toLocaleString();
        successSound.play();
      }

      setTimeout(() => {
        msgBox.textContent = '';
        resetDisplay();
      }, 1000);

    } catch (error) {
      console.error('49560 바코드 처리 오류:', error);
      msgBox.textContent = '❌ 처리 중 오류 발생';
      errorSound.play();
    }
  }

  // 3. 키보드 입력으로 49560-L3010 바코드 처리
  function handle49560KeyboardInput(inputValue) {
    const parsedData = parse49560Barcode(inputValue);
    
    if (parsedData) {
      process49560Barcode(parsedData);
      return true;
    } else {
      msgBox.textContent = '❌ 잘못된 49560 바코드 형식입니다. (예: 49560-L3010)';
      errorSound.play();
      return false;
    }
  }

  // 4. 자동 완성으로 49560-L3010 바코드 생성
  function generate49560Barcode(partNumber, category) {
    // 파트 번호가 5자리 숫자인지 확인
    if (!/^\d{5}$/.test(partNumber)) {
      return null;
    }
    
    // 카테고리가 알파벳+4자리 숫자인지 확인
    if (!/^[A-Z]\d{4}$/.test(category)) {
      return null;
    }
    
    return `${partNumber}-${category}`;
  }

  barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const raw = barcodeInput.value.trim();
      if (!raw) return;
      
      const cleanedRaw = raw.replace(/\s+/g, '');
      barcodeInput.value = '';

      // 49560-L3010 형식 체크
      if (cleanedRaw.match(/^\d{5}-[A-Z]\d{4}$/)) {
        handle49560KeyboardInput(cleanedRaw);
        return;
      }

      // 기존 GS1-128 형식 처리
      if (!cleanedRaw.startsWith('[') || !cleanedRaw.endsWith('*EOT')) {
        msgBox.textContent = '❌ Invalid barcode format. Must start with [ and end with *EOT.';
        errorSound.play();
        return resetDisplay();
      }

      const partMatch = cleanedRaw.match(/P(\w+)/);
      const qtyMatch = cleanedRaw.match(/7Q(\d+)/);
      const tagMatch = cleanedRaw.match(/3S(\w+)/);

      const part = partMatch?.[1] || '';
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;
      const tag = tagMatch?.[1] || '';
      const now = new Date();

      if (!part || !qty || !tag) {
        msgBox.textContent = '❌ Required elements missing in barcode (P, 7Q, 3S).';
        errorSound.play();
        return resetDisplay();
      }

      processBarcode(part, qty, tag, cleanedRaw, now);
    }
  });

  async function processBarcode(part, qty, tag, cleanedRaw, now) {
    const { data: existing } = await supabase
      .from('barcode_transactions')
      .select('id')
      .eq('tag_number', tag)
      .eq('action_type', 'IN')
      .maybeSingle();

    if (existing) {
      // Update scan time for existing record
      const { error: updateError } = await supabase
        .from('barcode_transactions')
        .update({
          scan_date: now.toISOString().slice(0, 10),
          scan_time: now.toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        msgBox.textContent = '❌ Failed to update scan time: ' + updateError.message;
        errorSound.play();
      } else {
        msgBox.textContent = '✅ Scan time updated for existing TAG.';
        duplicateSound.play();
      }
      return resetDisplay();
    }

    const { error } = await supabase
      .from('barcode_transactions')
      .insert([{
        part_number: part,
        quantity: qty,
        tag_number: tag,
        raw_data: cleanedRaw,
        action_type: 'IN',
        scan_date: now.toISOString().slice(0, 10),
        scan_time: now.toISOString()
      }]);

    if (error) {
      msgBox.textContent = '❌ Save failed: ' + error.message;
      errorSound.play();
    } else {
      msgBox.textContent = '✅ Barcode saved successfully.';
      partEl.textContent = part;
      qtyEl.textContent = qty;
      tagEl.textContent = tag;
      dateEl.textContent = now.toLocaleString();
      successSound.play();
    }

    setTimeout(() => {
      msgBox.textContent = '';
      resetDisplay();
    }, 1000);
  }

  function resetDisplay() {
    partEl.textContent = '-';
    qtyEl.textContent = '-';
    tagEl.textContent = '-';
    dateEl.textContent = '-';
    barcodeInput.focus();
  }

  // 📷 카메라 스캔 관련 요소
  const startBtn = document.getElementById('startCameraBtn');
  const stopBtn = document.getElementById('stopCameraBtn');
  const cameraContainer = document.getElementById('cameraContainer');
  const html5QrCode = new Html5Qrcode("reader");

  startBtn.addEventListener('click', async () => {
    cameraContainer.classList.remove('hidden');

    try {
      const devices = await Html5Qrcode.getCameras();

      if (devices && devices.length > 0) {
        const backCamera = devices.find(device =>
          device.label.toLowerCase().includes('back')
        ) || devices[0];

        await html5QrCode.start(
          backCamera.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (scannedText) => {
            const raw = scannedText.trim();
            const cleanedRaw = raw.replace(/\s+/g, '');

            // 49560-L3010 형식 체크
            if (cleanedRaw.match(/^\d{5}-[A-Z]\d{4}$/)) {
              handle49560KeyboardInput(cleanedRaw);
              html5QrCode.stop();
              cameraContainer.classList.add('hidden');
              return;
            }

            // 기존 GS1-128 형식 처리
            if (!cleanedRaw.startsWith('[') || !cleanedRaw.endsWith('*EOT')) {
              msgBox.textContent = '❌ Invalid barcode format. Must start with [ and end with *EOT.';
              errorSound.play();
              html5QrCode.stop();
              cameraContainer.classList.add('hidden');
              return;
            }

            const partMatch = cleanedRaw.match(/P(\w+)/);
            const qtyMatch = cleanedRaw.match(/7Q(\d+)/);
            const tagMatch = cleanedRaw.match(/3S(\w+)/);

            const part = partMatch?.[1] || '';
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;
            const tag = tagMatch?.[1] || '';
            const now = new Date();

            if (!part || !qty || !tag) {
              msgBox.textContent = '❌ Required elements missing in barcode (P, 7Q, 3S).';
              errorSound.play();
              html5QrCode.stop();
              cameraContainer.classList.add('hidden');
              return;
            }

            const { data: existing } = await supabase
              .from('barcode_transactions')
              .select('id')
              .eq('tag_number', tag)
              .eq('action_type', 'IN')
              .maybeSingle();

            if (existing) {
              const { error: updateError } = await supabase
                .from('barcode_transactions')
                .update({
                  scan_date: now.toISOString().slice(0, 10),
                  scan_time: now.toISOString()
                })
                .eq('id', existing.id);

              if (updateError) {
                msgBox.textContent = '❌ Failed to update scan time: ' + updateError.message;
                errorSound.play();
              } else {
                msgBox.textContent = '✅ Scan time updated for existing TAG.';
                duplicateSound.play();
              }
            } else {
              const { error } = await supabase
                .from('barcode_transactions')
                .insert([{
                  part_number: part,
                  quantity: qty,
                  tag_number: tag,
                  raw_data: cleanedRaw,
                  action_type: 'IN',
                  scan_date: now.toISOString().slice(0, 10),
                  scan_time: now.toISOString()
                }]);

              if (error) {
                msgBox.textContent = '❌ Save failed: ' + error.message;
                errorSound.play();
              } else {
                msgBox.textContent = '✅ Barcode saved successfully.';
                partEl.textContent = part;
                qtyEl.textContent = qty;
                tagEl.textContent = tag;
                dateEl.textContent = now.toLocaleString();
                successSound.play();
              }
            }

            html5QrCode.stop();
            cameraContainer.classList.add('hidden');
            setTimeout(() => {
              msgBox.textContent = '';
              resetDisplay();
            }, 1000);
          },
          () => {} // 오류 무시
        );
      } else {
        msgBox.textContent = '❌ No camera found.';
        errorSound.play();
      }
    } catch (err) {
      msgBox.textContent = '❌ Camera access error: ' + err.message;
      errorSound.play();
      cameraContainer.classList.add('hidden');
    }
  });

  stopBtn.addEventListener('click', async () => {
    try {
      await html5QrCode.stop();
    } catch (err) {
      console.warn('Stop error:', err);
    }
    cameraContainer.classList.add('hidden');
  });
}); 