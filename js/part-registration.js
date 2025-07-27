// Part Registration JavaScript
// config.js와 supabase-client.js를 참조하여 parts DB에서 데이터 로드

class PartRegistration {
    constructor() {
        this.parts = [];
        this.filteredParts = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.editingPart = null;
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
        document.getElementById('cancelDelete').addEventListener('click', () => {
            document.getElementById('deleteModal').classList.add('hidden');
        });

        document.getElementById('confirmDelete').addEventListener('click', () => {
            if (this.deletingPart) {
                this.deletePart(this.deletingPart);
                document.getElementById('deleteModal').classList.add('hidden');
            }
        });

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

    async submitPart() {
        const form = document.getElementById('partForm');
        const formData = new FormData(form);
        
        const partData = {
            part_number: formData.get('partNumber').trim(),
            category: formData.get('category'),
            status: formData.get('status')
        };

        // Validation
        if (!partData.part_number || !partData.category || !partData.status) {
            this.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }

        // Check if part number already exists (only for new parts)
        if (!this.editingPart && this.parts.some(p => p.part_number === partData.part_number)) {
            this.showNotification('이미 등록된 파트 번호입니다.', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            if (this.editingPart) {
                // Update existing part
                console.log('파트 수정 시도:', this.editingPart, partData);
                const updatedPart = await window.partService.updatePart(this.editingPart, partData);
                
                // Update local array
                const index = this.parts.findIndex(p => p.id === this.editingPart);
                if (index !== -1) {
                    this.parts[index] = updatedPart;
                }
                
                this.showNotification('파트가 성공적으로 수정되었습니다.', 'success');
            } else {
                // Insert new part
                console.log('새 파트 등록 시도:', partData);
                const newPart = await window.partService.createPart(partData);
                
                // Add to local array
                this.parts.unshift(newPart);
                
                this.showNotification('파트가 성공적으로 등록되었습니다.', 'success');
            }
            
            this.filteredParts = [...this.parts];
            this.renderParts();
            this.updateStats();
            this.resetForm();
            
        } catch (error) {
            console.error('Error submitting part:', error);
            this.showNotification(this.editingPart ? '파트 수정에 실패했습니다.' : '파트 등록에 실패했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    resetForm() {
        document.getElementById('partForm').reset();
        this.editingPart = null;
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i>등록';
        }
    }

    editPart(id) {
        const part = this.parts.find(p => p.id === id);
        if (!part) return;

        document.getElementById('partNumber').value = part.part_number;
        document.getElementById('category').value = part.category;
        document.getElementById('status').value = part.status.toLowerCase();

        this.editingPart = id;
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i>수정';
        }
    }

    showDeleteModal(id) {
        this.deletingPart = id;
        document.getElementById('deleteModal').classList.remove('hidden');
    }

    async deletePart(id) {
        try {
            this.showLoading(true);
            
            console.log('파트 삭제 시도:', id);
            
            if (!window.partService) {
                console.error('partService가 로드되지 않았습니다.');
                this.showNotification('데이터베이스 서비스를 사용할 수 없습니다.', 'error');
                return;
            }

            await window.partService.deletePart(id);

            // Remove from local array
            this.parts = this.parts.filter(p => p.id !== id);
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
                    <td colspan="4" class="text-center py-8 text-white/60">
                        ${this.filteredParts.length === 0 ? '등록된 파트가 없습니다.' : '검색 결과가 없습니다.'}
                    </td>
                </tr>
            `;
            return;
        }

        console.log('파트 목록 HTML 생성 중...');
        tbody.innerHTML = pageParts.map(part => `
            <tr class="border-b border-white/10 hover:bg-white/5 transition-colors">
                <td class="py-3 px-4 text-white">${part.part_number}</td>
                <td class="py-3 px-4 text-white">${part.category}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${
                        part.status === 'active' ? 'bg-green-100/20 text-green-300' :
                        part.status === 'inactive' ? 'bg-orange-100/20 text-orange-300' :
                        'bg-red-100/20 text-red-300'
                    }">
                        ${this.getStatusText(part.status)}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button onclick="window.partRegistration.editPart(${part.id})" 
                                class="text-blue-300 hover:text-blue-200 transition-colors">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="window.partRegistration.showDeleteModal(${part.id})" 
                                class="text-red-300 hover:text-red-200 transition-colors">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

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
                        class="px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30 transition-colors">
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
                            class="px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30 transition-colors">
                        ${i}
                    </button>
                `;
            }
        }
        
        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `
                <button onclick="window.partRegistration.goToPage(${this.currentPage + 1})" 
                        class="px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30 transition-colors">
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