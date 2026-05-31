<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="app-root">
	<div class="phone-frame no-scrollbar">
		{@render children()}
	</div>
</div>

<style>
	.app-root {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle at 50% 30%, #1a1a1d 0%, #000 80%);
	}

	/* Mobile-first: fill the screen. On larger screens, constrain to a phone frame. */
	.phone-frame {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #000;
	}

	@media (min-width: 480px) {
		.phone-frame {
			width: min(440px, 100vw);
			height: min(956px, 100vh);
			border-radius: 28px;
			box-shadow:
				0 0 0 10px #111,
				0 30px 80px rgba(0, 0, 0, 0.6);
		}
	}
</style>
