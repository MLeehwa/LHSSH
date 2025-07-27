// Part Registration JavaScript with Supabase Integration

class PartRegistration {
    constructor() {
        this.parts = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filteredParts = [];
        this.currentEditId = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadParts();
        this.setupAutoCategory();
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
    }

    setupAutoCategory() {
        const partNumberInput = document.getElementById('partNumber');
        const categorySelect = document.getElementById('category');

        partNumberInput.addEventListener('input', (e) => {
            const partNumber = e.target.value;
            const category = this.getCategoryFromPartNumber(partNumber);
            
            if (category) {
                categorySelect.value = category;
            } else {
                categorySelect.value = '';
            }
        });
    }

    getCategoryFromPartNumber(partNumber) {
        if (!partNumber) return '';
        
        // Check for 49601 first (6 digits), then 49600 and 49560 (5 digits)
        if (partNumber.startsWith('49601')) {
            return 'REAR';
        } else if (partNumber.startsWith('49600')) {
            return 'REAR';
        } else if (partNumber.startsWith('49560')) {
            return 'INNER';
        }
        
        return '';
    }

    async loadParts() {
        try {
            console.log('파트 데이터 로드 시작...');
            
            // Supabase에서 파트 데이터 로드
            if (window.partService) {
                console.log('partService 사용하여 데이터 로드...');
                this.parts = await window.partService.getAllParts();
            } else {
                console.error('partService가 로드되지 않았습니다.');
                this.parts = [];
            }
            
            console.log('로드된 파트 데이터:', this.parts);
            this.filteredParts = [...this.parts];
            this.renderParts();
            this.updateStats();
        } catch (error) {
            console.error('Error loading parts:', error);
            this.showNotification('파트 목록을 불러오는데 실패했습니다.', 'error');
        }
    }

    async submitPart() {
        const form = document.getElementById('partForm');
        const formData = new FormData(form);
        
        const partData = {
            part_number: formData.get('partNumber'),
            category: formData.get('category'),
            status: formData.get('status')
        };

        try {
            if (this.currentEditId) {
                // 수정 모드
                await window.partService.updatePart(this.currentEditId, partData);
                this.showNotification('파트가 성공적으로 수정되었습니다.', 'success');
            } else {
                // 새로 생성 모드
                await window.partService.createPart(partData);
                this.showNotification('파트가 성공적으로 등록되었습니다.', 'success');
            }
            
            this.resetForm();
            this.loadParts();
        } catch (error) {
            console.error('Error submitting part:', error);
            this.showNotification('파트 저장에 실패했습니다.', 'error');
        }
    }

    resetForm() {
        document.getElementById('partForm').reset();
        this.currentEditId = null;
        document.getElementById('submitBtn').textContent = '파트 등록';
    }

    renderParts() {
        const container = document.getElementById('partsContainer');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const partsToShow = this.filteredParts.slice(startIndex, endIndex);

        console.log('렌더링할 파트:', partsToShow);

        if (partsToShow.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                        등록된 파트가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = partsToShow.map(part => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${part.part_number}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        part.category === 'INNER' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }">
                        ${part.category}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        part.status === 'active' ? 'bg-green-100 text-green-800' :
                        part.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                    }">
                        ${this.getStatusText(part.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="partRegistration.editPart(${part.id})" 
                            class="text-indigo-600 hover:text-indigo-900 mr-3">
                        수정
                    </button>
                    <button onclick="partRegistration.showDeleteModal(${part.id})" 
                            class="text-red-600 hover:text-red-900">
                        삭제
                    </button>
                </td>
            </tr>
        `).join('');

        this.renderPagination();
    }

    getStatusText(status) {
        const statusMap = {
            'active': '활성',
            'inactive': '비활성',
            'discontinued': '단종'
        };
        return statusMap[status] || status;
    }

    async editPart(id) {
        const part = this.parts.find(p => p.id === id);
        if (!part) return;

        // 폼에 데이터 채우기
        document.getElementById('partNumber').value = part.part_number;
        document.getElementById('category').value = part.category;
        document.getElementById('status').value = part.status;

        this.currentEditId = id;
        document.getElementById('submitBtn').textContent = '파트 수정';

        // 폼으로 스크롤
        document.getElementById('partForm').scrollIntoView({ behavior: 'smooth' });
    }

    showDeleteModal(id) {
        if (confirm('정말로 이 파트를 삭제하시겠습니까?')) {
            this.deletePart(id);
        }
    }

    async deletePart(id) {
        try {
            await window.partService.deletePart(id);
            this.showNotification('파트가 성공적으로 삭제되었습니다.', 'success');
            this.loadParts();
        } catch (error) {
            console.error('Error deleting part:', error);
            this.showNotification('파트 삭제에 실패했습니다.', 'error');
        }
    }

    updateStats() {
        const totalParts = this.parts.length;
        const activeParts = this.parts.filter(p => p.status === 'active').length;
        const innerParts = this.parts.filter(p => p.category === 'INNER').length;
        const rearParts = this.parts.filter(p => p.category === 'REAR').length;

        document.getElementById('totalParts').textContent = totalParts;
        document.getElementById('activeParts').textContent = activeParts;
        document.getElementById('innerParts').textContent = innerParts;
        document.getElementById('rearParts').textContent = rearParts;
    }

    showNotification(message, type = 'info') {
        // 기존 알림 시스템 사용
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredParts.length / this.itemsPerPage);
        const paginationContainer = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = `
            <nav class="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
                <div class="flex flex-1 justify-between sm:hidden">
                    <button onclick="partRegistration.changePage(${this.currentPage - 1})" 
                            class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                                this.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                            }">
                        이전
                    </button>
                    <button onclick="partRegistration.changePage(${this.currentPage + 1})" 
                            class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                                this.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                            }">
                        다음
                    </button>
                </div>
                <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                        <p class="text-sm text-gray-700">
                            총 <span class="font-medium">${this.filteredParts.length}</span>개 중 
                            <span class="font-medium">${(this.currentPage - 1) * this.itemsPerPage + 1}</span> - 
                            <span class="font-medium">${Math.min(this.currentPage * this.itemsPerPage, this.filteredParts.length)}</span>
                        </p>
                    </div>
                    <div>
                        <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm">
        `;

        // 페이지 번호 버튼들
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button onclick="partRegistration.changePage(${i})" 
                        class="relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                            i === this.currentPage 
                                ? 'z-10 bg-indigo-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600' 
                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                        }">
                    ${i}
                </button>
            `;
        }

        paginationHTML += `
                        </nav>
                    </div>
                </div>
            </nav>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    changePage(page) {
        const totalPages = Math.ceil(this.filteredParts.length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.renderParts();
    }
}

// 전역 인스턴스 생성
window.partRegistration = new PartRegistration(); 