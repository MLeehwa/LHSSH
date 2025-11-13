// Internationalization (i18n) Configuration
// Supports English, Korean, and Spanish

const i18n = {
    currentLanguage: 'ko', // Default language
    
    translations: {
        ko: {
            // Common
            main_menu: '메인 메뉴',
            back: '뒤로',
            home: '홈',
            save: '저장',
            cancel: '취소',
            confirm: '확인',
            delete: '삭제',
            edit: '수정',
            add: '추가',
            search: '검색',
            clear: '초기화',
            loading: '로딩 중...',
            error: '오류',
            success: '성공',
            warning: '경고',
            info: '정보',
            hide_keyboard: '키보드 숨김',
            
            // PDA System
            pda_system: 'PDA 시스템',
            mobile_work_env: '모바일 작업 환경',
            hello: '안녕하세요!',
            select_work_mode: '작업할 모드를 선택하세요',
            
            // Main Menu Items
            inbound_work: '입고 작업',
            new_item_inbound: '새로운 물품 입고 처리',
            outbound_work: '출고 작업',
            item_outbound_delivery: '물품 출고 및 배송 처리',
            inventory_check: '재고 확인',
            current_inventory_status: '현재 재고 현황 조회',
            physical_inventory: '실사 재고',
            physical_inventory_desc: '바코드 스캔 및 수동 등록',
            
            // Inbound
            inbound_title: '입고 작업',
            inbound_subtitle: '컨테이너 스캔 및 확정',
            container_selection: '컨테이너 선택',
            pending_container: 'PENDING 컨테이너',
            select_container: '컨테이너를 선택하세요',
            selected_container_info: '선택된 컨테이너 정보',
            container_number: '컨테이너 번호',
            arn_number: 'ARN 번호',
            registration_date: '등록일',
            part_count: '파트 수',
            barcode_scan: '바코드 스캔',
            part_number_scan: '파트 번호 스캔',
            scan_barcode_placeholder: '바코드를 스캔하거나 파트 번호를 입력하세요',
            start_scan: '스캔 시작',
            parts_list: '파트 목록',
            registered_quantity: '등록 수량',
            scanned_quantity: '스캔 수량',
            remaining_quantity: '남은 수량',
            inbound_confirmation: '입고 확정',
            all_parts_scanned: '모든 파트 스캔 완료',
            
            // Outbound
            outbound_title: '출고 작업',
            outbound_subtitle: '바코드 스캔 및 출고 등록',
            date_shift_selection: '날짜 및 차수 선택',
            date: '날짜',
            shift: '차수',
            select_shift: '차수를 선택하세요',
            shift_1: '1차',
            shift_2: '2차',
            shift_3: '3차',
            shift_as: 'AS',
            outbound_parts_list: '스캔된 파트 목록',
            scanning_in_progress: '스캔 진행 중...',
            barcode_quantity: '바코드 수량',
            status: '상태',
            outbound_registration: '출고 등록',
            quantity_confirmed: '수량이 확인되었습니다. 출고를 등록하시겠습니까?',
            as_manual_input: 'AS 수동 입력',
            
            // Inventory
            inventory_title: '재고 확인',
            inventory_subtitle: '현재 재고 현황 조회',
            current_inventory: '현재 재고',
            total_parts: '총 파트 수',
            part_number: '파트 번호',
            quantity: '수량',
            location: '위치',
            last_updated: '마지막 업데이트',
            
            // Physical Inventory
            physical_inventory_title: '실사 재고',
            physical_inventory_subtitle: '바코드 스캔 및 수동 등록',
            session_info: '세션 정보',
            session_name: '세션명',
            session_name_placeholder: '예: 2024년 1월 실사',
            inventory_date: '실사 날짜',
            barcode_scan_placeholder: '바코드를 스캔하세요...',
            manual_registration: '수동 등록',
            select_part: '파트를 선택하세요',
            inventory_quantity: '실사 수량',
            inventory_quantity_placeholder: '실사 수량을 입력하세요',
            progress: '진행률',
            scanned_items: '스캔된 항목',
            inventory_items_list: '실사 항목 목록',
            registration_method: '등록 방식',
            registration_time: '등록 시간',
            action: '작업',
            save_inventory: '실사 저장',
            clear_all: '전체 초기화',
            save_confirmation: '실사 저장 확인',
            save_confirmation_text: '현재 스캔된 모든 항목을 실사 세션으로 저장하시겠습니까?',
            
            // Additional Physical Inventory terms
            db_stock: 'DB 재고',
            physical_stock: '실사 수량',
            difference: '차이',
            refresh_db_stock: 'DB 재고 새로고침',
            session_label: '세션',
            new_session: '-- 새 세션 --',
            scanned_count: '{count}개 스캔됨',
            large_difference_alert: '차이 큰 항목이 있습니다',
            large_difference_found: '차이 큰 항목 {count}개 발견',
            go_to: '이동',
            all: '전체',
            has_difference: '차이 있음',
            large_difference_only: '큰 차이만',
            normal: '정상',
            difference_desc: '차이 큰 순',
            part_number_asc: '파트 번호 순',
            difference_asc: '차이 작은 순',
            temporary_save: '임시 저장',
            permanent_save: '영구 저장',
            clear_confirmation: '초기화 확인',
            clear_confirmation_text: '현재 스캔된 모든 데이터를 초기화하시겠습니까?',
            clear_warning: '임시 저장 데이터도 함께 삭제됩니다.',
            clear_success: '모든 데이터가 초기화되었습니다.',
            box_unit_input: '박스 단위 입력',
            unit_per_box: '박스당 단위',
            box_count: '박스 개수',
            total_quantity: '총 수량',
            unit_count: '개',
            direct_quantity_input: '또는 직접 수량 입력',
            direct_quantity_placeholder: '직접 수량을 입력하세요',
            example: '예',
            
            // Inventory Calculator
            inventory_calculator: '재고 계산기',
            inventory_calculator_title: '재고 계산기',
            inventory_calculator_subtitle: '박스/잔량/렉 수량 계산',
            inventory_calculator_desc: '박스/잔량/렉 수량 계산',
            quantity_input: '수량 입력',
            quantity_per_box: '박스당 수량',
            remaining_quantity: '잔량',
            rack_quantity: '렉 수량',
            calculation_history: '계산 이력',
            save_to_inventory: '실사에 저장',
            scan_or_enter_part: '바코드 스캔 또는 직접 입력',
            no_history: '이력이 없습니다',
            box_quantities: '박스 수량',
            remaining_quantities: '잔량',
            rack_quantities: '렉 수량',
            physical_inventory_total: '실사 재고 총 수량',
            system_stock: '시스템 재고',
            added_parts_list: '추가된 파트 목록',
            add_to_list: '목록에 추가',
            save_all_to_inventory: '전체 저장',
            no_parts_added: '추가된 파트가 없습니다',
            session_info: '세션 정보',
            auto_session_info: '같은 날짜의 모든 파트가 자동으로 같은 세션에 묶입니다',
            inventory_calculation_table: '재고 계산 테이블',
            add_row: '행 추가',
            no: '번호',
            box_unit: '박스 UNIT',
            rack_unit: '렉 UNIT',
            summary: '요약',
            total_parts: '총 파트 수',
            clear_all: '전체 삭제',
            box_subtotal: '소계',
            rack_subtotal: '소계',
            box1_unit: '박스1 UNIT',
            box1_quantity: '박스1 수량',
            box1_subtotal: '박스1 소계',
            box2_unit: '박스2 UNIT',
            box2_quantity: '박스2 수량',
            box2_subtotal: '박스2 소계',
            
            // Status
            completed: '완료',
            pending: '대기',
            in_progress: '진행 중',
            error_occurred: '오류 발생',
            
            // Time
            current_time: '현재 시간',
            
            // User
            user: '사용자',
            logout: '로그아웃',
            
            // Language
            language: '언어',
            korean: '한국어',
            english: 'English',
            spanish: 'Español',
            
            // Messages
            logout_success: '로그아웃되었습니다.',
            supabase_connection_failed: 'Supabase 연결에 실패했습니다. 페이지를 새로고침해주세요.',
            select_container_placeholder: '컨테이너를 선택하세요',
            select_part_placeholder: '파트를 선택하세요',
            error_prefix: '오류: ',
            success_prefix: '성공: ',
            select_shift_first: '차수를 선택해주세요.',
            no_registered_parts: '등록된 파트가 없습니다.',
            select_part_option: '파트 선택',
            no_inventory_items: '실사 항목이 없습니다.',
            select_part_manual: '파트를 선택하세요',
            confirm_delete_all: '모든 초기 재고 데이터를 삭제하시겠습니까?',
            confirm_logout: '로그아웃하시겠습니까?',
            file_read_error: '파일에서 데이터를 읽을 수 없습니다.',
            no_data: '데이터가 없습니다.',
            register_button: '등록',
            total_inventory_history: '총 <span id="totalHistoryCount">{count}</span>건의 실사 이력',
            total_inventory_history_filtered: '총 <span id="totalHistoryCount">{count}</span>건의 실사 이력 (필터됨)',
            select_part_required: '파트를 선택해주세요.',
            quantity_required: '수량을 입력해주세요.',
            master_parts_load_error: '마스터 파트 목록을 불러올 수 없습니다.'
        },
        
        en: {
            // Common
            main_menu: 'Main Menu',
            back: 'Back',
            home: 'Home',
            save: 'Save',
            cancel: 'Cancel',
            confirm: 'Confirm',
            delete: 'Delete',
            edit: 'Edit',
            add: 'Add',
            search: 'Search',
            clear: 'Clear',
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            warning: 'Warning',
            info: 'Info',
            hide_keyboard: 'Hide Keyboard',
            
            // PDA System
            pda_system: 'PDA System',
            mobile_work_env: 'Mobile Work Environment',
            hello: 'Hello!',
            select_work_mode: 'Select work mode',
            
            // Main Menu Items
            inbound_work: 'Inbound Work',
            new_item_inbound: 'New item inbound processing',
            outbound_work: 'Outbound Work',
            item_outbound_delivery: 'Item outbound and delivery processing',
            inventory_check: 'Inventory Check',
            current_inventory_status: 'Current inventory status inquiry',
            physical_inventory: 'Physical Inventory',
            physical_inventory_desc: 'Barcode scan and manual registration',
            
            // Inbound
            inbound_title: 'Inbound Work',
            inbound_subtitle: 'Container scan and confirmation',
            container_selection: 'Container Selection',
            pending_container: 'PENDING Container',
            select_container: 'Select container',
            selected_container_info: 'Selected Container Information',
            container_number: 'Container Number',
            arn_number: 'ARN Number',
            registration_date: 'Registration Date',
            part_count: 'Part Count',
            barcode_scan: 'Barcode Scan',
            part_number_scan: 'Part Number Scan',
            scan_barcode_placeholder: 'Scan barcode or enter part number',
            start_scan: 'Start Scan',
            parts_list: 'Parts List',
            registered_quantity: 'Registered Qty',
            scanned_quantity: 'Scanned Qty',
            remaining_quantity: 'Remaining Qty',
            inbound_confirmation: 'Inbound Confirmation',
            all_parts_scanned: 'All parts scanned',
            
            // Outbound
            outbound_title: 'Outbound Work',
            outbound_subtitle: 'Barcode scan and outbound registration',
            date_shift_selection: 'Date and Shift Selection',
            date: 'Date',
            shift: 'Shift',
            select_shift: 'Select shift',
            shift_1: '1st',
            shift_2: '2nd',
            shift_3: '3rd',
            shift_as: 'AS',
            outbound_parts_list: 'Scanned Parts List',
            scanning_in_progress: 'Scanning in progress...',
            barcode_quantity: 'Barcode Qty',
            status: 'Status',
            outbound_registration: 'Outbound Registration',
            quantity_confirmed: 'Quantity confirmed. Register outbound?',
            as_manual_input: 'AS Manual Input',
            
            // Inventory
            inventory_title: 'Inventory Check',
            inventory_subtitle: 'Current inventory status inquiry',
            current_inventory: 'Current Inventory',
            total_parts: 'Total Parts',
            part_number: 'Part Number',
            quantity: 'Quantity',
            location: 'Location',
            last_updated: 'Last Updated',
            
            // Physical Inventory
            physical_inventory_title: 'Physical Inventory',
            physical_inventory_subtitle: 'Barcode scan and manual registration',
            session_info: 'Session Info',
            session_name: 'Session Name',
            session_name_placeholder: 'e.g., January 2024 Inventory',
            inventory_date: 'Inventory Date',
            barcode_scan_placeholder: 'Scan barcode...',
            manual_registration: 'Manual Registration',
            select_part: 'Select part',
            inventory_quantity: 'Inventory Qty',
            inventory_quantity_placeholder: 'Enter inventory quantity',
            progress: 'Progress',
            scanned_items: 'Scanned Items',
            inventory_items_list: 'Inventory Items List',
            registration_method: 'Registration Method',
            registration_time: 'Registration Time',
            action: 'Action',
            save_inventory: 'Save Inventory',
            clear_all: 'Clear All',
            save_confirmation: 'Save Confirmation',
            save_confirmation_text: 'Save all currently scanned items as inventory session?',
            
            // Additional Physical Inventory terms
            db_stock: 'DB Stock',
            physical_stock: 'Physical Stock',
            difference: 'Difference',
            refresh_db_stock: 'Refresh DB Stock',
            session_label: 'Session',
            new_session: '-- New Session --',
            scanned_count: '{count} scanned',
            large_difference_alert: 'Large differences found',
            large_difference_found: '{count} items with large differences',
            go_to: 'Go To',
            all: 'All',
            has_difference: 'Has Difference',
            large_difference_only: 'Large Difference Only',
            normal: 'Normal',
            difference_desc: 'Difference (Desc)',
            part_number_asc: 'Part Number (Asc)',
            difference_asc: 'Difference (Asc)',
            temporary_save: 'Temporary Save',
            permanent_save: 'Permanent Save',
            clear_confirmation: 'Clear Confirmation',
            clear_confirmation_text: 'Clear all currently scanned data?',
            clear_warning: 'Temporary saved data will also be deleted.',
            clear_success: 'All data has been cleared.',
            box_unit_input: 'Box Unit Input',
            unit_per_box: 'Unit per Box',
            box_count: 'Box Count',
            total_quantity: 'Total Quantity',
            unit_count: 'pcs',
            direct_quantity_input: 'Or Enter Quantity Directly',
            direct_quantity_placeholder: 'Enter quantity directly',
            example: 'e.g.',
            
            // Inventory Calculator
            inventory_calculator: 'Inventory Calculator',
            inventory_calculator_title: 'Inventory Calculator',
            inventory_calculator_subtitle: 'Box/Remaining/Rack Quantity Calculation',
            inventory_calculator_desc: 'Box/Remaining/Rack Quantity Calculation',
            quantity_input: 'Quantity Input',
            quantity_per_box: 'Quantity per Box',
            remaining_quantity: 'Remaining Quantity',
            rack_quantity: 'Rack Quantity',
            calculation_history: 'Calculation History',
            save_to_inventory: 'Save to Inventory',
            scan_or_enter_part: 'Scan barcode or enter directly',
            no_history: 'No history',
            box_quantities: 'Box Quantities',
            remaining_quantities: 'Remaining Quantities',
            rack_quantities: 'Rack Quantities',
            physical_inventory_total: 'Physical Inventory Total',
            system_stock: 'System Stock',
            added_parts_list: 'Added Parts List',
            add_to_list: 'Add to List',
            save_all_to_inventory: 'Save All to Inventory',
            no_parts_added: 'No parts added',
            session_info: 'Session Info',
            auto_session_info: 'All parts on the same date are automatically grouped into the same session',
            inventory_calculation_table: 'Inventory Calculation Table',
            add_row: 'Add Row',
            no: 'No.',
            box_unit: 'Box UNIT',
            rack_unit: 'Rack UNIT',
            summary: 'Summary',
            total_parts: 'Total Parts',
            clear_all: 'Clear All',
            box_subtotal: 'Subtotal',
            rack_subtotal: 'Subtotal',
            box1_unit: 'Box1 UNIT',
            box1_quantity: 'Box1 Qty',
            box1_subtotal: 'Box1 Subtotal',
            box2_unit: 'Box2 UNIT',
            box2_quantity: 'Box2 Qty',
            box2_subtotal: 'Box2 Subtotal',
            
            // Status
            completed: 'Completed',
            pending: 'Pending',
            in_progress: 'In Progress',
            error_occurred: 'Error Occurred',
            
            // Time
            current_time: 'Current Time',
            
            // User
            user: 'User',
            logout: 'Logout',
            
            // Language
            language: 'Language',
            korean: '한국어',
            english: 'English',
            spanish: 'Español',
            
            // Messages
            logout_success: 'Logged out successfully.',
            supabase_connection_failed: 'Failed to connect to Supabase. Please refresh the page.',
            select_container_placeholder: 'Select container',
            select_part_placeholder: 'Select part',
            error_prefix: 'Error: ',
            success_prefix: 'Success: ',
            select_shift_first: 'Please select a shift.',
            no_registered_parts: 'No registered parts.',
            select_part_option: 'Select Part',
            no_inventory_items: 'No inventory items.',
            select_part_manual: 'Select part',
            confirm_delete_all: 'Delete all initial inventory data?',
            confirm_logout: 'Logout?',
            file_read_error: 'Cannot read data from file.',
            no_data: 'No data.',
            register_button: 'Register',
            total_inventory_history: 'Total <span id="totalHistoryCount">{count}</span> inventory history',
            total_inventory_history_filtered: 'Total <span id="totalHistoryCount">{count}</span> inventory history (filtered)',
            select_part_required: 'Please select a part.',
            quantity_required: 'Please enter quantity.',
            master_parts_load_error: 'Cannot load master parts list.'
        },
        
        es: {
            // Common
            main_menu: 'Menú Principal',
            back: 'Atrás',
            home: 'Inicio',
            save: 'Guardar',
            cancel: 'Cancelar',
            confirm: 'Confirmar',
            delete: 'Eliminar',
            edit: 'Editar',
            add: 'Agregar',
            search: 'Buscar',
            clear: 'Limpiar',
            loading: 'Cargando...',
            error: 'Error',
            success: 'Éxito',
            warning: 'Advertencia',
            info: 'Información',
            hide_keyboard: 'Ocultar Teclado',
            
            // PDA System
            pda_system: 'Sistema PDA',
            mobile_work_env: 'Entorno de Trabajo Móvil',
            hello: '¡Hola!',
            select_work_mode: 'Seleccione modo de trabajo',
            
            // Main Menu Items
            inbound_work: 'Trabajo de Entrada',
            new_item_inbound: 'Procesamiento de entrada de nuevos artículos',
            outbound_work: 'Trabajo de Salida',
            item_outbound_delivery: 'Procesamiento de salida y entrega de artículos',
            inventory_check: 'Verificación de Inventario',
            current_inventory_status: 'Consulta de estado actual del inventario',
            physical_inventory: 'Inventario Físico',
            physical_inventory_desc: 'Escaneo de código de barras y registro manual',
            
            // Inbound
            inbound_title: 'Trabajo de Entrada',
            inbound_subtitle: 'Escaneo de contenedor y confirmación',
            container_selection: 'Selección de Contenedor',
            pending_container: 'Contenedor PENDIENTE',
            select_container: 'Seleccionar contenedor',
            selected_container_info: 'Información del Contenedor Seleccionado',
            container_number: 'Número de Contenedor',
            arn_number: 'Número ARN',
            registration_date: 'Fecha de Registro',
            part_count: 'Cantidad de Partes',
            barcode_scan: 'Escaneo de Código de Barras',
            part_number_scan: 'Escaneo de Número de Parte',
            scan_barcode_placeholder: 'Escanee código de barras o ingrese número de parte',
            start_scan: 'Iniciar Escaneo',
            parts_list: 'Lista de Partes',
            registered_quantity: 'Cant. Registrada',
            scanned_quantity: 'Cant. Escaneada',
            remaining_quantity: 'Cant. Restante',
            inbound_confirmation: 'Confirmación de Entrada',
            all_parts_scanned: 'Todas las partes escaneadas',
            
            // Outbound
            outbound_title: 'Trabajo de Salida',
            outbound_subtitle: 'Escaneo de código de barras y registro de salida',
            date_shift_selection: 'Selección de Fecha y Turno',
            date: 'Fecha',
            shift: 'Turno',
            select_shift: 'Seleccionar turno',
            shift_1: '1er',
            shift_2: '2do',
            shift_3: '3er',
            shift_as: 'AS',
            outbound_parts_list: 'Lista de Partes Escaneadas',
            scanning_in_progress: 'Escaneando en progreso...',
            barcode_quantity: 'Cant. Código de Barras',
            status: 'Estado',
            outbound_registration: 'Registro de Salida',
            quantity_confirmed: 'Cantidad confirmada. ¿Registrar salida?',
            as_manual_input: 'Entrada Manual AS',
            
            // Inventory
            inventory_title: 'Verificación de Inventario',
            inventory_subtitle: 'Consulta de estado actual del inventario',
            current_inventory: 'Inventario Actual',
            total_parts: 'Total de Partes',
            part_number: 'Número de Parte',
            quantity: 'Cantidad',
            location: 'Ubicación',
            last_updated: 'Última Actualización',
            
            // Physical Inventory
            physical_inventory_title: 'Inventario Físico',
            physical_inventory_subtitle: 'Escaneo de código de barras y registro manual',
            session_info: 'Información de Sesión',
            session_name: 'Nombre de Sesión',
            session_name_placeholder: 'ej., Inventario Enero 2024',
            inventory_date: 'Fecha de Inventario',
            barcode_scan_placeholder: 'Escanee código de barras...',
            manual_registration: 'Registro Manual',
            select_part: 'Seleccionar parte',
            inventory_quantity: 'Cant. Inventario',
            inventory_quantity_placeholder: 'Ingrese cantidad de inventario',
            progress: 'Progreso',
            scanned_items: 'Artículos Escaneados',
            inventory_items_list: 'Lista de Artículos de Inventario',
            registration_method: 'Método de Registro',
            registration_time: 'Tiempo de Registro',
            action: 'Acción',
            save_inventory: 'Guardar Inventario',
            clear_all: 'Limpiar Todo',
            save_confirmation: 'Confirmación de Guardado',
            save_confirmation_text: '¿Guardar todos los artículos escaneados como sesión de inventario?',
            
            // Additional Physical Inventory terms
            db_stock: 'Stock DB',
            physical_stock: 'Stock Físico',
            difference: 'Diferencia',
            refresh_db_stock: 'Actualizar Stock DB',
            session_label: 'Sesión',
            new_session: '-- Nueva Sesión --',
            scanned_count: '{count} escaneados',
            large_difference_alert: 'Se encontraron grandes diferencias',
            large_difference_found: '{count} artículos con grandes diferencias',
            go_to: 'Ir A',
            all: 'Todos',
            has_difference: 'Tiene Diferencia',
            large_difference_only: 'Solo Gran Diferencia',
            normal: 'Normal',
            difference_desc: 'Diferencia (Desc)',
            part_number_asc: 'Número de Parte (Asc)',
            difference_asc: 'Diferencia (Asc)',
            temporary_save: 'Guardar Temporal',
            permanent_save: 'Guardar Permanente',
            clear_confirmation: 'Confirmación de Limpieza',
            clear_confirmation_text: '¿Limpiar todos los datos escaneados actualmente?',
            clear_warning: 'Los datos guardados temporalmente también se eliminarán.',
            clear_success: 'Todos los datos han sido limpiados.',
            box_unit_input: 'Entrada de Unidad de Caja',
            unit_per_box: 'Unidad por Caja',
            box_count: 'Cantidad de Cajas',
            total_quantity: 'Cantidad Total',
            unit_count: 'pcs',
            direct_quantity_input: 'O Ingrese Cantidad Directamente',
            direct_quantity_placeholder: 'Ingrese cantidad directamente',
            
            // Inventory Calculator
            inventory_calculator: 'Calculadora de Inventario',
            inventory_calculator_title: 'Calculadora de Inventario',
            inventory_calculator_subtitle: 'Cálculo de Cantidad de Caja/Restante/Rack',
            inventory_calculator_desc: 'Cálculo de Cantidad de Caja/Restante/Rack',
            quantity_input: 'Entrada de Cantidad',
            quantity_per_box: 'Cantidad por Caja',
            remaining_quantity: 'Cantidad Restante',
            rack_quantity: 'Cantidad de Rack',
            calculation_history: 'Historial de Cálculo',
            save_to_inventory: 'Guardar en Inventario',
            scan_or_enter_part: 'Escanear código de barras o ingresar directamente',
            no_history: 'Sin historial',
            box_quantities: 'Cantidades de Caja',
            remaining_quantities: 'Cantidades Restantes',
            rack_quantities: 'Cantidades de Rack',
            physical_inventory_total: 'Total de Inventario Físico',
            system_stock: 'Stock del Sistema',
            added_parts_list: 'Lista de Partes Agregadas',
            add_to_list: 'Agregar a Lista',
            save_all_to_inventory: 'Guardar Todo en Inventario',
            no_parts_added: 'No hay partes agregadas',
            session_info: 'Información de Sesión',
            auto_session_info: 'Todas las partes de la misma fecha se agrupan automáticamente en la misma sesión',
            inventory_calculation_table: 'Tabla de Cálculo de Inventario',
            add_row: 'Agregar Fila',
            no: 'No.',
            box_unit: 'Unidad de Caja',
            rack_unit: 'Unidad de Rack',
            summary: 'Resumen',
            total_parts: 'Total de Partes',
            clear_all: 'Borrar Todo',
            box_subtotal: 'Subtotal',
            rack_subtotal: 'Subtotal',
            box1_unit: 'Caja1 UNIT',
            box1_quantity: 'Cantidad Caja1',
            box1_subtotal: 'Subtotal Caja1',
            box2_unit: 'Caja2 UNIT',
            box2_quantity: 'Cantidad Caja2',
            box2_subtotal: 'Subtotal Caja2',
            example: 'ej.',
            
            // Status
            completed: 'Completado',
            pending: 'Pendiente',
            in_progress: 'En Progreso',
            error_occurred: 'Error Ocurrido',
            
            // Time
            current_time: 'Hora Actual',
            
            // User
            user: 'Usuario',
            logout: 'Cerrar Sesión',
            
            // Language
            language: 'Idioma',
            korean: '한국어',
            english: 'English',
            spanish: 'Español',
            
            // Messages
            logout_success: 'Sesión cerrada exitosamente.',
            supabase_connection_failed: 'Error al conectar con Supabase. Por favor, actualice la página.',
            select_container_placeholder: 'Seleccionar contenedor',
            select_part_placeholder: 'Seleccionar parte',
            error_prefix: 'Error: ',
            success_prefix: 'Éxito: ',
            select_shift_first: 'Por favor seleccione un turno.',
            no_registered_parts: 'No hay partes registradas.',
            select_part_option: 'Seleccionar Parte',
            no_inventory_items: 'No hay artículos de inventario.',
            select_part_manual: 'Seleccionar parte',
            confirm_delete_all: '¿Eliminar todos los datos de inventario inicial?',
            confirm_logout: '¿Cerrar sesión?',
            file_read_error: 'No se puede leer datos del archivo.',
            no_data: 'Sin datos.',
            register_button: 'Registrar',
            total_inventory_history: 'Total <span id="totalHistoryCount">{count}</span> historial de inventario',
            total_inventory_history_filtered: 'Total <span id="totalHistoryCount">{count}</span> historial de inventario (filtrado)',
            select_part_required: 'Por favor seleccione una parte.',
            quantity_required: 'Por favor ingrese la cantidad.',
            master_parts_load_error: 'No se puede cargar la lista de partes maestras.'
        }
    },
    
    // Initialize language from localStorage or default to Korean
    init() {
        const savedLanguage = localStorage.getItem('language') || 'ko';
        this.setLanguage(savedLanguage);
    },
    
    // Set language and update all elements
    setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('language', lang);
        this.updateAllElements();
    },
    
    // Get translation for a key
    t(key, params = {}) {
        let translation = this.translations[this.currentLanguage]?.[key] || key;
        
        // Replace parameters in translation
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{${param}}`, params[param]);
        });
        
        return translation;
    },
    
    // Update all elements with data-i18n attributes
    updateAllElements() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation !== key) {
                element.textContent = translation;
            }
        });
        
        // Update placeholders
        const inputs = document.querySelectorAll('input[data-i18n-placeholder]');
        inputs.forEach(input => {
            const key = input.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation !== key) {
                input.placeholder = translation;
            }
        });
        
        // Update title attributes
        const elementsWithTitle = document.querySelectorAll('[data-i18n-title]');
        elementsWithTitle.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation !== key) {
                element.setAttribute('title', translation);
            }
        });
        
        // Update title
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.getAttribute('data-i18n')) {
            const key = titleElement.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation !== key) {
                titleElement.textContent = translation;
            }
        }
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
});

// Export for use in other scripts
window.i18n = i18n;