@Get(':id/stats')
async getStats(@Param('id', ParseIntPipe) id: number) {
  return this.storesService.getStoreStats(id);
}
