<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="app-root">
	<div class="phone-frame no-scrollbar">
		{@render children()}
	</div>
</div>
