// Service API pour les appels backend
class ApiService {
  constructor() {
    this.baseURL = window.location.origin;
  }

  async fetchHomeData() {
    try {
      const response = await fetch(`${this.baseURL}/api/home`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Important pour les cookies de session
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
      throw error;
    }
  }
}

export default new ApiService();
