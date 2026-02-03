// Composant carte de statistique
export default {
  name: 'StatCard',
  props: {
    title: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    icon: {
      type: String,
      default: 'bi-graph-up'
    },
    color: {
      type: String,
      default: 'primary'
    }
  },
  template: `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-body text-center p-4">
        <div class="mb-3">
          <i :class="['bi', icon, 'fs-1', 'text-' + color]"></i>
        </div>
        <h3 class="display-4 fw-bold mb-2">{{ value }}</h3>
        <p class="text-muted mb-0">{{ title }}</p>
      </div>
    </div>
  `
};
