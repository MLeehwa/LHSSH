// Part Registration JavaScript
// config.js와 supabase-client.js를 참조하여 parts DB에서 데이터 로드

class PartRegistration {
    constructor() {
        this.parts = [];
        this.filteredParts = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.deletingPart = null;
        this.init();
    }

    async init() {
        try {
            console.log('PartRegistration 초기화 시작...');
            
            // config.js와 supabase-client.js가 로드되었는지 확인
            if (typeof window.getCurrentConfig === 'undefined') {
                console.error('config.js가 로드되지 않았습니다.');
                this.showNotification('설정 파일을 불러올 수 없습니다.', 'error');
                return;
            }

            if (typeof window.partService === 'undefined') {
                console.error('supabase-client.js가 로드되지 않았습니다.');
                this.showNotification('데이터베이스 클라이언트를 불러올 수 없습니다.', 'error');
                return;
            }

            console.log('설정 확인 완료:', {
                config: window.getCurrentConfig(),
                partService: window.partService
            });

            await this.loadParts();
            this.bindEvents();
            this.updateStats();
            console.log('PartRegistration 초기화 완료');
        } catch (error) {
            console.error('PartRegistration 초기화 오류:', error);
            this.showNotification('초기화 중 오류가 발생했습니다.', 'error');
        }
    }

    async loadParts() {
        try {
            console.log('파트 데이터 로드 시작...');
            
            if (!window.partService) {
                console.error('partService가 로드되지 않았습니다.');
                this.showNotification('데이터베이스 서비스를 사용할 수 없습니다.', 'error');
                return;
            }

            console.log('partService 사용하여 데이터 로드...');
            this.parts = await window.partService.getAllParts();
            console.log('로드된 파트 데이터:', this.parts);
            
            this.filteredParts = [...this.parts];
            this.renderParts();
            this.updateStats();
            
        } catch (error) {
            console.error('파트 데이터 로드 중 오류:', error);
            this.showNotification('파트 목록을 불러오는데 실패했습니다.', 'error');
        }
    }

    bindEvents() {
        // Form submission
        document.getElementById('partForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPart();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetForm();
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterParts();
        });

        // 파트 번호 입력 시 카테고리 자동 설정
        document.getElementById('partNumber').addEventListener('input', (e) => {
            const partNumber = e.target.value.trim();
            const category = this.getCategoryFromPartNumber(partNumber);
            const categoryInput = document.getElementById('category');
            const categoryDisplay = document.getElementById('categoryDisplay');
            
            if (categoryInput) {
                categoryInput.value = category;
            }
            
            if (categoryDisplay) {
                if (partNumber.length >= 5) {
                    categoryDisplay.textContent = `자동 설정: ${category}`;
                    categoryDisplay.className = 'text-sm text-blue-600 font-medium';
                } else {
                    categoryDisplay.textContent = '파트 번호를 입력하면 자동으로 설정됩니다';
                    categoryDisplay.className = 'text-sm text-gray-500';
                }
            }
        });

        // Category filter
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.filterParts();
        });

        // Status filter
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterParts();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadParts();
        });

        // Modal events
        const cancelDeleteBtn = document.getElementById('cancelDelete');
        const confirmDeleteBtn = document.getElementById('confirmDelete');
        
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => {
                console.log('삭제 취소 버튼 클릭됨');
                document.getElementById('deleteModal').classList.add('hidden');
            });
        } else {
            console.error('cancelDelete 버튼을 찾을 수 없습니다.');
        }

        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                console.log('삭제 확인 버튼 클릭됨');
                console.log('deletingPart ID:', this.deletingPart);
                if (this.deletingPart) {
                    console.log('파트 삭제 시작:', this.deletingPart);
                    this.deletePart(this.deletingPart);
                    document.getElementById('deleteModal').classList.add('hidden');
                } else {
                    console.error('deletingPart가 설정되지 않았습니다.');
                }
            });
        } else {
            console.error('confirmDelete 버튼을 찾을 수 없습니다.');
        }

        // Auto category setup
        this.setupAutoCategory();
    }

    setupAutoCategory() {
        const partNumberInput = document.getElementById('partNumber');
        const categorySelect = document.getElementById('category');
        
        partNumberInput.addEventListener('input', (e) => {
            const partNumber = e.target.value;
            if (partNumber) {
                const category = this.determineCategory(partNumber);
                if (category) {
                    categorySelect.value = category;
                }
            }
        });
    }

    determineCategory(partNumber) {
        if (!partNumber) return null;
        
        // 파트 번호에서 카테고리 결정 로직
        const cleanPartNumber = this.removeTrailingAlphabet(partNumber);
        
        if (cleanPartNumber.startsWith('49560')) {
            return 'REAR';
        } else if (cleanPartNumber.startsWith('49600')) {
            return 'INNER';
        } else if (cleanPartNumber.startsWith('49601')) {
            return 'OUTER';
        }
        
        return null;
    }

    removeTrailingAlphabet(partNumber) {
        if (!partNumber || typeof partNumber !== 'string') {
            return partNumber;
        }
        return partNumber.replace(/[A-Za-z]+$/, '');
    }

    // 파트 번호에 따른 카테고리 자동 분류
    getCategoryFromPartNumber(partNumber) {
        if (!partNumber || typeof partNumber !== 'string') {
            return 'UNKNOWN';
        }
        
        // 49560으로 시작하면 INNER
        if (partNumber.startsWith('49560')) {
            return 'INNER';
        }
        // 49600, 49601로 시작하면 REAR
        else if (partNumber.startsWith('49600') || partNumber.startsWith('49601')) {
            return 'REAR';
        }
        // 그 외에는 UNKNOWN
        else {
            return 'UNKNOWN';
        }
    }

    async submitPart() {
        const form = document.getElementById('partForm');
        const formData = new FormData(form);
        
        let partNumber = formData.get('partNumber').trim();
        
        // $ 기호를 S로 변환 (49580-$9000 → 49580-S9000)
        if (partNumber.includes('$')) {
            partNumber = partNumber.replace(/\$/g, 'S');
            console.log('$ 기호 변환:', formData.get('partNumber').trim(), '→', partNumber);
        }
        
        const partData = {
            part_number: partNumber,
            category: this.getCategoryFromPartNumber(partNumber), // 파트 번호에 따라 자동 분류
            status: formData.get('status').toUpperCase() // 소문자를 대문자로 변환
        };

        // Validation
        if (!partData.part_number || !partData.category || !partData.status) {
            this.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }

        // Check if part number already exists
        if (this.parts.some(p => p.part_number === partData.part_number)) {
            this.showNotification('이미 등록된 파트 번호입니다.', 'error');
            return;
        }

        // 서버에서도 중복 체크 (더 강화)
        try {
            console.log('중복 체크 시작:', partData.part_number);
            const existingParts = await window.partService.getAllParts();
            console.log('기존 파트 목록:', existingParts.map(p => p.part_number));
            
            const isDuplicate = existingParts.some(p => p.part_number === partData.part_number);
            if (isDuplicate) {
                console.log('중복 파트 발견:', partData.part_number);
                this.showNotification(`파트 번호 '${partData.part_number}'는 이미 등록되어 있습니다.`, 'error');
                return;
            }
            console.log('중복 체크 통과:', partData.part_number);
        } catch (error) {
            console.warn('서버 중복 체크 실패, 계속 진행:', error);
        }

        try {
            this.showLoading(true);
            
            // Insert new part
            console.log('새 파트 등록 시도:', partData);
            const newPart = await window.partService.createPart(partData);
            
            // Add to local array
            this.parts.unshift(newPart);
            
            this.showNotification('파트가 성공적으로 등록되었습니다.', 'success');
            
            this.filteredParts = [...this.parts];
            this.renderParts();
            this.updateStats();
            this.resetForm();
            
        } catch (error) {
            console.error('Error submitting part:', error);
            
            // 중복 키 오류 처리
            if (error.message && error.message.includes('duplicate key')) {
                this.showNotification('이미 등록된 파트 번호입니다.', 'error');
            } else if (error.message && error.message.includes('23505')) {
                this.showNotification('이미 등록된 파트 번호입니다.', 'error');
            } else {
                this.showNotification('파트 등록에 실패했습니다.', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    resetForm() {
        document.getElementById('partForm').reset();
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = `<i class="fas fa-save mr-2"></i>${i18n.t('register_button')}`;
        }
        
        // 카테고리 표시 초기화
        const categoryDisplay = document.getElementById('categoryDisplay');
        if (categoryDisplay) {
            categoryDisplay.textContent = '파트 번호를 입력하면 자동으로 설정됩니다';
            categoryDisplay.className = 'text-sm text-gray-500';
        }
        
        // 카테고리 값 초기화
        const categoryInput = document.getElementById('category');
        if (categoryInput) {
            categoryInput.value = 'UNKNOWN';
        }
    }


    showDeleteModal(partNumber) {
        console.log('삭제 모달 표시:', partNumber);
        this.deletingPart = partNumber;
        document.getElementById('deleteModal').classList.remove('hidden');
        console.log('deletingPart 설정됨:', this.deletingPart);
    }

    async deletePart(partNumber) {
        try {
            this.showLoading(true);
            
            console.log('파트 삭제 시도:', partNumber);
            
            if (!window.partService) {
                console.error('partService가 로드되지 않았습니다.');
                this.showNotification('데이터베이스 서비스를 사용할 수 없습니다.', 'error');
                return;
            }

            await window.partService.deletePart(partNumber);

            // Remove from local array
            this.parts = this.parts.filter(p => p.part_number !== partNumber);
            this.filteredParts = [...this.parts];
            this.renderParts();
            this.updateStats();
            
            this.showNotification('파트가 성공적으로 삭제되었습니다.', 'success');
            
        } catch (error) {
            console.error('Error deleting part:', error);
            this.showNotification('파트 삭제에 실패했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    filterParts() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredParts = this.parts.filter(part => {
            const matchesSearch = !searchTerm || 
                part.part_number.toLowerCase().includes(searchTerm);
            
            const matchesCategory = !categoryFilter || 
                part.category === categoryFilter;
            
            const matchesStatus = !statusFilter || 
                part.status.toLowerCase() === statusFilter.toLowerCase();
            
            return matchesSearch && matchesCategory && matchesStatus;
        });

        this.currentPage = 1;
        this.renderParts();
    }

    renderParts() {
        console.log('=== 파트 목록 렌더링 시작 ===');
        console.log('전체 파트 수:', this.parts.length);
        console.log('필터된 파트 수:', this.filteredParts.length);
        console.log('현재 페이지:', this.currentPage);
        
        const tbody = document.getElementById('partsTableBody');
        if (!tbody) {
            console.error('partsTableBody 엘리먼트를 찾을 수 없습니다!');
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageParts = this.filteredParts.slice(startIndex, endIndex);
        
        console.log('현재 페이지 파트 수:', pageParts.length);
        console.log('페이지 범위:', startIndex, '-', endIndex);

        if (pageParts.length === 0) {
            console.log('표시할 파트가 없습니다. 빈 메시지 표시');
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-gray-500">
                        ${this.filteredParts.length === 0 ? '등록된 파트가 없습니다.' : '검색 결과가 없습니다.'}
                    </td>
                </tr>
            `;
            return;
        }

        console.log('파트 목록 HTML 생성 중...');
        console.log('페이지 파트 데이터:', pageParts);
        tbody.innerHTML = pageParts.map(part => {
            console.log('개별 파트 데이터:', part);
            console.log('파트 ID:', part.id);
            return `
            <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td class="py-3 px-4 text-gray-800">${part.part_number}</td>
                <td class="py-3 px-4 text-gray-800">${part.category}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${
                        part.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        part.status === 'INACTIVE' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                    }">
                        ${this.getStatusText(part.status)}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button onclick="console.log('삭제 버튼 클릭, 파트 번호:', '${part.part_number}'); window.partRegistration.showDeleteModal('${part.part_number}')" 
                                class="text-red-600 hover:text-red-800 transition-colors">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        console.log('파트 목록 HTML 생성 완료');
        this.renderPagination();
        console.log('=== 파트 목록 렌더링 완료 ===');
    }

    getStatusText(status) {
        switch(status.toLowerCase()) {
            case 'active': return '활성';
            case 'inactive': return '비활성';
            case 'discontinued': return '단종';
            default: return status;
        }
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredParts.length / this.itemsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="flex space-x-2">';
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `
                <button onclick="window.partRegistration.goToPage(${this.currentPage - 1})" 
                        class="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">
                    이전
                </button>
            `;
        }
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                paginationHTML += `
                    <button class="px-3 py-1 bg-blue-600 text-white rounded">
                        ${i}
                    </button>
                `;
            } else {
                paginationHTML += `
                    <button onclick="window.partRegistration.goToPage(${i})" 
                            class="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">
                        ${i}
                    </button>
                `;
            }
        }
        
        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `
                <button onclick="window.partRegistration.goToPage(${this.currentPage + 1})" 
                        class="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">
                    다음
                </button>
            `;
        }
        
        paginationHTML += '</div>';
        pagination.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderParts();
    }

    updateStats() {
        const totalParts = this.parts.length;
        const activeParts = this.parts.filter(p => p.status === 'active').length;
        const inactiveParts = this.parts.filter(p => p.status === 'inactive').length;
        const categories = new Set(this.parts.map(p => p.category)).size;

        document.getElementById('totalParts').textContent = totalParts;
        document.getElementById('activeParts').textContent = activeParts;
        document.getElementById('inactiveParts').textContent = inactiveParts;
        document.getElementById('totalCategories').textContent = categories;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${
            type === 'success' ? 'bg-green-600 text-white' :
            type === 'error' ? 'bg-red-600 text-white' :
            type === 'warning' ? 'bg-yellow-600 text-white' :
            'bg-blue-600 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${
                    type === 'success' ? 'fa-check-circle' :
                    type === 'error' ? 'fa-exclamation-circle' :
                    type === 'warning' ? 'fa-exclamation-triangle' :
                    'fa-info-circle'
                } mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.partRegistration = new PartRegistration();
});