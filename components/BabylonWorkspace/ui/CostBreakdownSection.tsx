import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { DollarSign, TrendingUp, Users, Wrench, Building } from 'lucide-react';

interface CostBreakdownData {
  total: number;
  labor: number;
  materials: number;
  overhead: number;
  elements: Array<{ id: string; name: string; cost: number }>;
}

interface CostBreakdownSectionProps {
  costBreakdown: CostBreakdownData;
}

export function CostBreakdownSection({ costBreakdown }: CostBreakdownSectionProps) {
  // Defensive defaults - a partial/incomplete cost breakdown (missing fields from an
  // upstream calculation) should never crash this panel with a toLocaleString-on-undefined error.
  const total = costBreakdown?.total ?? 0;
  const labor = costBreakdown?.labor ?? 0;
  const materials = costBreakdown?.materials ?? 0;
  const overhead = costBreakdown?.overhead ?? 0;
  const elements = costBreakdown?.elements ?? [];

  // Calculate percentages for progress bars
  const laborPercent = total > 0 ? (labor / total) * 100 : 0;
  const materialsPercent = total > 0 ? (materials / total) * 100 : 0;
  const overheadPercent = total > 0 ? (overhead / total) * 100 : 0;

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="cost-breakdown-section"
    >
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Cost */}
          <motion.div
            variants={itemVariants}
            className="total-cost text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"
          >
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              ${total.toLocaleString()}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">
              Total Project Cost
            </div>
          </motion.div>

          {/* Breakdown Categories */}
          <motion.div variants={itemVariants} className="breakdown-categories space-y-3">
            <div className="category-item">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Labor</span>
                </div>
                <Badge variant="secondary">${labor.toLocaleString()}</Badge>
              </div>
              <Progress value={laborPercent} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">{laborPercent.toFixed(1)}%</div>
            </div>

            <div className="category-item">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">Materials</span>
                </div>
                <Badge variant="secondary">${materials.toLocaleString()}</Badge>
              </div>
              <Progress value={materialsPercent} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">{materialsPercent.toFixed(1)}%</div>
            </div>

            <div className="category-item">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Overhead</span>
                </div>
                <Badge variant="secondary">${overhead.toLocaleString()}</Badge>
              </div>
              <Progress value={overheadPercent} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">{overheadPercent.toFixed(1)}%</div>
            </div>
          </motion.div>

          {/* Elements Table */}
          {elements.length > 0 && (
            <motion.div variants={itemVariants} className="elements-table">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium">Element Costs</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Element</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elements.map((element, index) => (
                      <motion.tr
                        key={element.id}
                        variants={itemVariants}
                        className="border-t"
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: index * 0.05 }}
                      >
                        <TableCell className="font-mono text-xs">{element.id}</TableCell>
                        <TableCell className="font-medium">{element.name}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${element.cost.toLocaleString()}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
